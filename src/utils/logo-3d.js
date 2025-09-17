// CODEX: 3D logo animation (add-only, minimal GPU load)
(function(){
  const root = document.documentElement;
  const svg = document.querySelector('.iip-logo-3d-svg');
  if(!svg) return;

  // Respect reduced motion
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let raf = 0, t0 = 0;
  function tick(ts){
    raf = requestAnimationFrame(tick);
    if(!t0) t0 = ts;
    const t = (ts - t0) / 1000; // seconds
    // Gentle rotation that feels like a physical object
    const rx = Math.sin(t * 0.35) * 6;   // degrees
    const ry = Math.cos(t * 0.27) * 10;  // degrees
    const el = svg.closest('.iip-logo-3d');
    if(el){
      el.style.transform = `translate(-50%,-50%) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }
  }

  function start(){
    if(reduce) return; // no animation
    if(raf) return;
    raf = requestAnimationFrame(tick);
  }
  function stop(){
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
  }

  // Start/stop based on theme to avoid work when not visible
  const obs = new MutationObserver(()=>{
    const active = root.getAttribute('data-theme') === 'console';
    if(active){ start(); } else { stop(); }
  });
  obs.observe(root, { attributes:true, attributeFilter:['data-theme'] });

  // Initialize once
  if(root.getAttribute('data-theme') === 'console') start();
})();
