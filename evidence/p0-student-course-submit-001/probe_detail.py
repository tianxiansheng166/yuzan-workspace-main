"""Probe the course detail API to understand the response structure."""
import requests, json

BASE = "http://127.0.0.1:4000/api/v1"
r = requests.post(f"{BASE}/auth/login", json={"identifier": "student.test", "password": "YuzanTest!2026"})
d = r.json().get("data", r.json())
token = d.get("accessToken", "")
sid = d.get("activeSchoolId", "")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

r2 = requests.get(f"{BASE}/schools/{sid}/student/courses/85000000-0000-4000-8000-000000000004", headers=headers)
j = r2.json()
data = j.get("data", j)

print("=== Top-level keys ===")
print(list(data.keys()))

# Find submission-related keys
for k in data.keys():
    v = data[k]
    if "sub" in k.lower() or "enroll" in k.lower() or "revision" in k.lower():
        print(f"\n  {k}: {json.dumps(v, indent=2)[:500]}")

# Also check if there's a nested submission inside data
if "existingSubmission" in data:
    print("\n=== existingSubmission ===")
    print(json.dumps(data["existingSubmission"], indent=2)[:500])
elif "submission" in data:
    print("\n=== submission ===")
    print(json.dumps(data["submission"], indent=2)[:500])
