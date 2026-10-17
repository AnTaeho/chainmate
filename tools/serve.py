# 로컬 서버(CHM-75): python3 -m http.server와 같고 연결 대기열만 5 → 128로 늘렸다.
# 대기열 5에서는 모듈 125개를 한꺼번에 받다 몇 개가 끊겨(ERR_CONNECTION_RESET) 첫 화면이 안 뜰 때가 있다. 쓰기: python3 tools/serve.py [포트=8000]
import functools
import http.server
import pathlib
import sys


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = pathlib.Path(__file__).resolve().parent.parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
with Server(('', port), handler) as srv:  # http.server처럼 모든 주소에서 받는다(같은 망의 폰으로 열기)
    print(f'http://127.0.0.1:{port}/')
    srv.serve_forever()
