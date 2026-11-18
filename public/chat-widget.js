/* FootprintOS website chat bubble. Paste on a website:
   <script src="https://footprintgroupos.netlify.app/chat-widget.js" data-chat="PUBLIC_ID" async></script> */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var id = s.getAttribute("data-chat") || "";
  if (!/^[a-z0-9]{6,20}$/.test(id) || document.getElementById("fpos-chat-" + id)) return;
  var base = new URL(s.src).origin;
  var open = false;
  var frame = null;
  var btn = document.createElement("button");
  btn.id = "fpos-chat-" + id;
  btn.type = "button";
  btn.setAttribute("aria-label", "Chat with us");
  btn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  btn.style.cssText = "position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;background:#de2277;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center";
  function place() {
    if (!frame) return;
    var small = window.innerWidth < 480;
    frame.style.cssText = "position:fixed;z-index:2147483647;border:0;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.3);" +
      (small ? "left:0;top:0;width:100%;height:100%;border-radius:0" : "right:20px;bottom:92px;width:370px;height:560px;max-height:calc(100vh - 110px);border-radius:12px") +
      ";display:" + (open ? "block" : "none");
  }
  function toggle() {
    open = !open;
    if (open && !frame) {
      frame = document.createElement("iframe");
      frame.title = "Chat with us";
      frame.src = base + "/c/" + id + "?embed=1&page=" + encodeURIComponent(location.href.slice(0, 300));
      document.body.appendChild(frame);
    }
    place();
    btn.setAttribute("aria-expanded", String(open));
  }
  btn.addEventListener("click", toggle);
  window.addEventListener("resize", place);
  window.addEventListener("message", function (e) {
    if (e.origin === base && e.data && e.data.fposChat === id && e.data.close && open) toggle();
  });
  document.body.appendChild(btn);
})();
