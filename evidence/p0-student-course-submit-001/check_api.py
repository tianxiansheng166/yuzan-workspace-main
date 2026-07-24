"""Quick check: is the backend API reachable and can we login?"""
import requests, sys
BASE = "http://127.0.0.1:4000/api/v1"
try:
    r = requests.post(f"{BASE}/auth/login", json={"identifier": "student.test", "password": "YuzanTest!2026"}, timeout=10)
    print(f"Login status: {r.status_code}")
    if r.status_code == 200:
        d = r.json().get("data", r.json())
        print(f"schoolId={d.get('activeSchoolId','')}")
        print(f"userId={d.get('user',{}).get('id','')}")
        print(f"tokenPresent={bool(d.get('accessToken',''))}")
    else:
        print(f"Response: {r.text[:300]}")
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)
