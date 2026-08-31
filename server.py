import http.server
import socketserver
import webbrowser
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

print(f'🚀 Servidor do Simulador de Entrevistas iniciado em: http://localhost:{PORT}')
print('Pressione Ctrl+C para encerrar.')
webbrowser.open(f'http://localhost:{PORT}')

with socketserver.TCPServer(('', PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor finalizado.')
