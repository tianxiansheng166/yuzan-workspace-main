import urllib.request, json

data = json.dumps({
    'identifier': 'student.test',
    'password': 'YuzanTest!2026'
}).encode()

req = urllib.request.Request(
    'http://127.0.0.1:4000/api/v1/auth/login',
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    r = urllib.request.urlopen(req)
    body = json.loads(r.read())
    print(f"Status: {r.status}")
    token = body.get('data', {}).get('accessToken', '')
    print(f"Token present: {bool(token)}")
    user = body.get('data', {}).get('user', {})
    print(f"User: {user.get('displayName', 'N/A')}")
    memberships = body.get('data', {}).get('memberships', [])
    for m in memberships:
        print(f"  School: {m.get('schoolName')} Role: {m.get('role')}")
except urllib.error.HTTPError as e:
    print(f"Error: {e.code}")
    print(e.read().decode())
except Exception as ex:
    print(f"Exception: {ex}")
