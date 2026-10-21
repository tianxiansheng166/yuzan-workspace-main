#!/usr/bin/env python3
"""Bounded host admission/watch for the isolated YZ-RD-T109 Docker stack."""

import argparse
import json
import os
import re
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml


TASK_ID = "YZ-RD-T109"
PROJECT = "yz-rd-t109"
RUNTIME = Path("/home/tian/.devspace/runtime/yz-rd-t109")
COMPOSE = RUNTIME / "compose.yaml"
EVIDENCE = Path(__file__).resolve().parent
GIB = 1024**3
MIB = 1024**2
MIN_MEMORY_MARGIN = 2 * GIB
MIN_SWAP_MARGIN = 2 * GIB
MIN_CPU_HEADROOM = 4.0
MAX_PROJECTED_THREAD_FRACTION = 0.75
BROWSER = {
    "role": "browser",
    "cpu": 0.75,
    "memory": 1120 * MIB,
    "memorySwapTotal": 1120 * MIB,
    "pids": 256,
}


def read_int(path):
    return int(Path(path).read_text().strip())


def parse_size(value):
    if isinstance(value, int):
        return value
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*([kmgt]?i?b?)?\s*", str(value), re.I)
    if not match:
        raise ValueError("unrecognized resource size")
    scale = {"": 1, "b": 1, "k": 1024, "kb": 1024, "kib": 1024,
             "m": MIB, "mb": MIB, "mib": MIB, "g": GIB, "gb": GIB,
             "gib": GIB, "t": 1024**4, "tb": 1024**4, "tib": 1024**4}
    return int(float(match.group(1)) * scale[match.group(2).lower() if match.group(2) else ""])


def run_json(args):
    return json.loads(subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL))


def cgroup_for(pid):
    for line in Path(f"/proc/{pid}/cgroup").read_text().splitlines():
        if line.startswith("0::"):
            return Path("/sys/fs/cgroup") / line[3:].lstrip("/")
    raise RuntimeError("unified cgroup path unavailable")


def read_cgroup(pid):
    path = cgroup_for(pid)
    values = {}
    for filename, key in (
        ("cpu.max", "cpuMax"),
        ("memory.max", "memoryMax"),
        ("memory.current", "memoryCurrent"),
        ("memory.swap.max", "memorySwapMax"),
        ("memory.swap.current", "memorySwapCurrent"),
        ("pids.max", "pidsMax"),
        ("pids.current", "pidsCurrent"),
        ("memory.events", "memoryEvents"),
    ):
        values[key] = (path / filename).read_text().strip()
    return values


def finite_int(value):
    if value == "max":
        return None
    return int(value)


def cpu_limit(cpu_max):
    quota, period = cpu_max.split()
    if quota == "max":
        return None
    return int(quota) / int(period)


def compose_expected():
    config = yaml.safe_load(COMPOSE.read_text())
    expected = {}
    for name, service in config["services"].items():
        memory = parse_size(service["mem_limit"])
        expected[name] = {
            "role": name,
            "cpu": float(service["cpus"]),
            "memory": memory,
            "memorySwapTotal": parse_size(service["memswap_limit"]),
            "pids": int(service["pids_limit"]),
        }
    expected[BROWSER["role"]] = BROWSER.copy()
    return expected


def host_snapshot():
    mem = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        key, _, value = line.partition(":")
        if key in {"MemAvailable", "SwapFree", "MemTotal", "SwapTotal"}:
            mem[key] = int(value.strip().split()[0]) * 1024
    pressure = {}
    for line in Path("/proc/pressure/io").read_text().splitlines():
        kind, *fields = line.split()
        pressure[kind] = {field.split("=", 1)[0]: float(field.split("=", 1)[1]) for field in fields if "=" in field}
    task_lines = subprocess.check_output(["ps", "-eLf"], text=True).splitlines()
    return {
        "capturedAtUtc": datetime.now(timezone.utc).isoformat(),
        "cpuCount": len(os.sched_getaffinity(0)),
        "memTotalBytes": mem["MemTotal"],
        "memAvailableBytes": mem["MemAvailable"],
        "swapTotalBytes": mem["SwapTotal"],
        "swapFreeBytes": mem["SwapFree"],
        "loadAverage": [float(value) for value in Path("/proc/loadavg").read_text().split()[:3]],
        "ioPressure": pressure,
        "kernelThreadsMax": read_int("/proc/sys/kernel/threads-max"),
        "kernelPidMax": read_int("/proc/sys/kernel/pid_max"),
        "hostTasksCurrent": max(0, len(task_lines) - 1),
    }


def inspect_running():
    ids = subprocess.check_output(["docker", "ps", "-q"], text=True).split()
    result = []
    for container_id in ids:
        item = run_json(["docker", "inspect", container_id])[0]
        state = item["State"]
        if state.get("Status") != "running" or not state.get("Pid"):
            # docker ps and inspect can observe opposite sides of a normal exit.
            continue
        labels = item["Config"].get("Labels") or {}
        try:
            cgroup = read_cgroup(state["Pid"])
        except FileNotFoundError:
            # A bounded one-shot Browser container may exit between inspect and
            # the cgroup read. Recheck its state once before treating this as
            # missing enforcement; never stop other owners for that race.
            time.sleep(0.25)
            item = run_json(["docker", "inspect", container_id])[0]
            state = item["State"]
            if state.get("Status") != "running" or not state.get("Pid"):
                continue
            cgroup = read_cgroup(state["Pid"])
        result.append({
            "id": item["Id"],
            "name": item["Name"].lstrip("/"),
            "image": item["Config"].get("Image"),
            "project": labels.get("com.docker.compose.project"),
            "service": labels.get("com.docker.compose.service"),
            "taskLabel": labels.get("io.yuzan.task"),
            "roleLabel": labels.get("io.yuzan.role"),
            "hostConfig": {
                "nanoCpus": item["HostConfig"].get("NanoCpus"),
                "memory": item["HostConfig"].get("Memory"),
                "memorySwapTotal": item["HostConfig"].get("MemorySwap"),
                "pidsLimit": item["HostConfig"].get("PidsLimit"),
            },
            "restartCount": item.get("RestartCount", 0),
            "oomKilled": state.get("OOMKilled", False),
            "health": (state.get("Health") or {}).get("Status"),
            "cgroup": cgroup,
        })
    return result


def assess():
    expected = compose_expected()
    host = host_snapshot()
    running = inspect_running()
    hard_failures = []
    soft_failures = []
    own_by_role = {}
    external = []

    for container in running:
        owned = container["project"] == PROJECT or container["taskLabel"] == TASK_ID
        if owned:
            role = container["roleLabel"] or container["service"]
            if role not in expected or role in own_by_role:
                hard_failures.append("duplicate or unexpected active T109 container")
                continue
            own_by_role[role] = container
            want = expected[role]
            cg = container["cgroup"]
            hc = container["hostConfig"]
            actual = {
                "cpu": cpu_limit(cg["cpuMax"]),
                "memory": finite_int(cg["memoryMax"]),
                "memorySwap": finite_int(cg["memorySwapMax"]),
                "pids": finite_int(cg["pidsMax"]),
            }
            expected_swap = max(0, want["memorySwapTotal"] - want["memory"])
            if (hc["nanoCpus"] != int(want["cpu"] * 1_000_000_000)
                    or hc["memory"] != want["memory"]
                    or hc["memorySwapTotal"] != want["memorySwapTotal"]
                    or hc["pidsLimit"] != want["pids"]
                    or actual["cpu"] is None or abs(actual["cpu"] - want["cpu"]) > 0.001
                    or actual["memory"] != want["memory"]
                    or actual["memorySwap"] != expected_swap
                    or actual["pids"] != want["pids"]):
                hard_failures.append(f"T109 {role} Docker/cgroup limits differ from the approved plan")
            events = dict(line.split() for line in cg["memoryEvents"].splitlines())
            if container["restartCount"] != 0 or container["oomKilled"] or int(events.get("oom", 0)) or int(events.get("oom_kill", 0)):
                hard_failures.append(f"T109 {role} restart or OOM evidence detected")
        else:
            external.append(container)
            cg = container["cgroup"]
            if (cpu_limit(cg["cpuMax"]) is None or finite_int(cg["memoryMax"]) is None
                    or finite_int(cg["memorySwapMax"]) is None or finite_int(cg["pidsMax"]) is None):
                hard_failures.append("active non-T109 container has an unlimited effective cgroup resource")

    # A named T109 resource without its task/project labels is an ownership drift.
    for container in running:
        if container["name"].startswith("yz-rd-t109-") and not (
            container["project"] == PROJECT or container["taskLabel"] == TASK_ID
        ):
            hard_failures.append("T109-named active container lacks T109 ownership labels")

    external_cpu = 0.0
    external_memory_growth = 0
    external_swap_growth = 0
    external_pid_growth = 0
    t109_cpu = 0.0
    t109_memory_growth = 0
    t109_swap_growth = 0
    t109_pid_growth = 0
    for container in external:
        cg = container["cgroup"]
        cpu = cpu_limit(cg["cpuMax"])
        memory_cap = finite_int(cg["memoryMax"])
        swap_cap = finite_int(cg["memorySwapMax"])
        pid_cap = finite_int(cg["pidsMax"])
        external_cpu += cpu or 0.0
        external_memory_growth += max(0, (memory_cap or 0) - int(cg["memoryCurrent"]))
        external_swap_growth += max(0, (swap_cap or 0) - int(cg["memorySwapCurrent"]))
        external_pid_growth += max(0, (pid_cap or 0) - int(cg["pidsCurrent"]))

    t109_plan = {"cpu": 0.0, "memory": 0, "memorySwap": 0, "pids": 0}
    for role, want in expected.items():
        container = own_by_role.get(role)
        if container:
            cg = container["cgroup"]
            cpu = cpu_limit(cg["cpuMax"])
            memory_cap = finite_int(cg["memoryMax"])
            swap_cap = finite_int(cg["memorySwapMax"])
            pid_cap = finite_int(cg["pidsMax"])
            t109_cpu += cpu or 0.0
            t109_memory_growth += max(0, (memory_cap or 0) - int(cg["memoryCurrent"]))
            t109_swap_growth += max(0, (swap_cap or 0) - int(cg["memorySwapCurrent"]))
            t109_pid_growth += max(0, (pid_cap or 0) - int(cg["pidsCurrent"]))
        else:
            t109_plan["cpu"] += want["cpu"]
            t109_plan["memory"] += want["memory"]
            t109_plan["memorySwap"] += max(0, want["memorySwapTotal"] - want["memory"])
            t109_plan["pids"] += want["pids"]
            t109_cpu += want["cpu"]
            t109_memory_growth += want["memory"]
            t109_swap_growth += max(0, want["memorySwapTotal"] - want["memory"])
            t109_pid_growth += want["pids"]

    cpu_sum = external_cpu + t109_cpu
    memory_growth = external_memory_growth + t109_memory_growth
    swap_growth = external_swap_growth + t109_swap_growth
    pid_growth = external_pid_growth + t109_pid_growth
    memory_margin = host["memAvailableBytes"] - memory_growth
    swap_margin = host["swapFreeBytes"] - swap_growth
    cpu_headroom = host["cpuCount"] - cpu_sum
    projected_tasks = host["hostTasksCurrent"] + pid_growth
    thread_headroom = host["kernelThreadsMax"] - projected_tasks
    if memory_margin < MIN_MEMORY_MARGIN:
        soft_failures.append("projected host MemAvailable margin is below 2 GiB")
    if swap_margin < MIN_SWAP_MARGIN:
        soft_failures.append("projected host SwapFree margin is below 2 GiB")
    if cpu_headroom < MIN_CPU_HEADROOM:
        soft_failures.append("projected CPU headroom is below 4 logical CPUs")
    if projected_tasks > int(host["kernelThreadsMax"] * MAX_PROJECTED_THREAD_FRACTION):
        soft_failures.append("projected host task count exceeds 75% of kernel threads-max")

    budget = {
        "activeExternalCpuCap": round(external_cpu, 4),
        "activeOrPlannedT109CpuCap": round(t109_cpu, 4),
        "activePlusPlannedCpuCap": round(cpu_sum, 4),
        "cpuHeadroom": round(cpu_headroom, 4),
        "activeExternalMemoryPotentialGrowthBytes": external_memory_growth,
        "t109PlannedMemoryBytes": t109_plan["memory"],
        "t109ActiveOrPlannedMemoryPotentialGrowthBytes": t109_memory_growth,
        "projectedMemAvailableMarginBytes": memory_margin,
        "activeExternalSwapPotentialGrowthBytes": external_swap_growth,
        "t109PlannedAdditionalSwapBytes": t109_plan["memorySwap"],
        "t109ActiveOrPlannedSwapPotentialGrowthBytes": t109_swap_growth,
        "projectedSwapFreeMarginBytes": swap_margin,
        "activeExternalPidPotentialGrowth": external_pid_growth,
        "t109PlannedPids": t109_plan["pids"],
        "t109ActiveOrPlannedPidPotentialGrowth": t109_pid_growth,
        "projectedHostTasks": projected_tasks,
        "kernelThreadsMax": host["kernelThreadsMax"],
        "threadHeadroom": thread_headroom,
    }
    return {
        "taskId": TASK_ID,
        "decision": "PASS" if not hard_failures and not soft_failures else "FAIL",
        "sourceT108Sha": "8974c2a7d5842bb20dbfcd091b63cac5674dcc32",
        "runtimeProject": PROJECT,
        "thresholds": {
            "minimumProjectedMemoryMarginBytes": MIN_MEMORY_MARGIN,
            "minimumProjectedSwapMarginBytes": MIN_SWAP_MARGIN,
            "minimumCpuHeadroom": MIN_CPU_HEADROOM,
            "maximumProjectedThreadFraction": MAX_PROJECTED_THREAD_FRACTION,
        },
        "host": host,
        "activeNonT109Containers": external,
        "activeT109Containers": list(own_by_role.values()),
        "plannedMissingT109Roles": [role for role in expected if role not in own_by_role],
        "budget": budget,
        "hardFailures": hard_failures,
        "softFailures": soft_failures,
    }


def stop_only_t109():
    subprocess.run(["docker", "compose", "-p", PROJECT, "-f", str(COMPOSE), "stop", "--timeout", "15"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    ids = subprocess.check_output([
        "docker", "ps", "-q", "--filter", f"label=io.yuzan.task={TASK_ID}"
    ], text=True).split()
    if ids:
        subprocess.run(["docker", "stop", "--time", "15", *ids],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--watch", action="store_true")
    parser.add_argument("--interval-seconds", type=float, default=2.0)
    parser.add_argument("--duration-seconds", type=float, default=1800.0)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    if not args.watch:
        snapshot = assess()
        rendered = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            args.output.write_text(rendered)
        else:
            sys.stdout.write(rendered)
        return 0 if snapshot["decision"] == "PASS" else 2

    log_path = args.output or (EVIDENCE / "resource-watch.jsonl")
    stop_requested = False

    def request_stop(_signum, _frame):
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    started = time.monotonic()
    consecutive_soft_failures = 0
    with log_path.open("a", encoding="utf-8") as log:
        while not stop_requested and time.monotonic() - started < args.duration_seconds:
            try:
                snapshot = assess()
            except Exception as error:
                snapshot = {"taskId": TASK_ID, "decision": "FAIL", "hardFailures": [f"resource inspection failed: {type(error).__name__}"], "softFailures": []}
            log.write(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n")
            log.flush()
            if snapshot.get("hardFailures"):
                stop_only_t109()
                return 3
            if snapshot.get("softFailures"):
                consecutive_soft_failures += 1
            else:
                consecutive_soft_failures = 0
            if consecutive_soft_failures >= 2:
                stop_only_t109()
                return 3
            time.sleep(max(0.5, args.interval_seconds))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
