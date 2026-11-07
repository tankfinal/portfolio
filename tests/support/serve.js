// A tiny static server for the Playwright tests: the repo root, like Cloudflare's assets.
// No dependencies, so it runs the same on a laptop, in the Playwright Docker image and in CI.
// /api/* is never served here: every test mocks it (see fixtures.js), so no test can reach the real D1.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const PORT = +process.argv[2] || 4321;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

http.createServer(function(req, res){
  var p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.startsWith("/api/")) { res.writeHead(404); res.end("api is mocked in tests"); return; }
  var file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, function(err, st){
    if (!err && st.isDirectory()) {
      // Like Cloudflare assets: /classic -> /classic/, /classic/ -> /classic/index.html
      if (!p.endsWith("/")) { res.writeHead(307, {Location: p + "/"}); res.end(); return; }
      file = path.join(file, "index.html");
    }
    fs.readFile(file, function(err2, buf){
      if (err2) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, {"Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store"});
      res.end(buf);
    });
  });
}).listen(PORT, "127.0.0.1", function(){ console.log("serving " + ROOT + " on http://127.0.0.1:" + PORT); });
