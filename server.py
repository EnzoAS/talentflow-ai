import os
import webbrowser
import uvicorn

PORT = int(os.environ.get("PORT", 8000))

if __name__ == "__main__":
    print(f'[TalentFlow AI] Servidor iniciado em: http://localhost:{PORT}')
    webbrowser.open(f'http://localhost:{PORT}')
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=True)
