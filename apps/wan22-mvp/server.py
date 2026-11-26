#!/usr/bin/env python3
"""
WAN22 OS MVP - Local Development Server
Serves the app and manages shared state via JSON file
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
from urllib.parse import urlparse

STATE_FILE = os.path.join(os.path.dirname(__file__), 'data', 'state.json')
SEED_FILE = os.path.join(os.path.dirname(__file__), 'state.json')


def ensure_state_file():
    """Copy seed state.json into data/state.json on first run, if needed"""
    if not os.path.exists(STATE_FILE) and os.path.exists(SEED_FILE):
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        with open(SEED_FILE, 'r', encoding='utf-8') as src:
            seed = src.read()
        with open(STATE_FILE, 'w', encoding='utf-8') as dst:
            dst.write(seed)

class ContractHandler(SimpleHTTPRequestHandler):
    """Handle HTTP requests for the app"""
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/api/state':
            self.handle_get_state()
        else:
            super().do_GET()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/api/state':
            self.handle_post_state()
        else:
            self.send_error(404)
    
    def handle_get_state(self):
        """Get current state from file"""
        try:
            if os.path.exists(STATE_FILE):
                with open(STATE_FILE, 'r', encoding='utf-8') as f:
                    state = json.load(f)
            else:
                state = self.get_default_state()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(state).encode('utf-8'))
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_post_state(self):
        """Save state to file"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            state = json.loads(body.decode('utf-8'))
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
            
            # Save state
            with open(STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
        except Exception as e:
            self.send_error(500, str(e))
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def end_headers(self):
        """Add CORS headers to all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    @staticmethod
    def get_default_state():
        """Return default state if file doesn't exist"""
        return {
            "contracts": [],
            "projects": [],
            "tasks": [],
            "costs": [],
            "billingCycles": [
                {"id": "monthly", "label": "รายเดือน (Monthly)", "value": "monthly"},
                {"id": "quarterly", "label": "รายไตรมาส (Quarterly)", "value": "quarterly"},
                {"id": "yearly", "label": "รายปี (Yearly)", "value": "yearly"},
                {"id": "onetime", "label": "ครั้งเดียว (One-time)", "value": "one-time"}
            ],
            "costTypes": [
                {"value": "labor", "label": "ค่าแรง/ค่าจ้าง"},
                {"value": "software", "label": "ซอฟต์แวร์/License"},
                {"value": "operational", "label": "ค่าดำเนินการ"},
                {"value": "material", "label": "วัสดุ/อุปกรณ์"},
                {"value": "other", "label": "อื่นๆ"}
            ]
        }


def run_server(port=None):
    """Start the development server"""
    if port is None:
        port = int(os.environ.get('PORT', 4180))
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ensure_state_file()
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, ContractHandler)
    print(f"🚀 WAN22 OS running on http://127.0.0.1:{port}/")
    print(f"📁 Working directory: {os.getcwd()}")
    print(f"💾 State file: {STATE_FILE}")
    print("Press Ctrl+C to stop\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Server stopped")
        httpd.server_close()


if __name__ == '__main__':
    run_server()
