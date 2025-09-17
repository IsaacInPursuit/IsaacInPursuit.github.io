// CODEX: Copper embers + faint light trails for Console theme (Canvas2D)
export function startConsoleParticles(canvas){
  const ctx = canvas.getContext('2d', { alpha:true });
  let w = canvas.clientWidth, h = canvas.clientHeight;
  const DPR = Math.max(1, devicePixelRatio || 1);
  canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ return { stop(){}, resize(){} }; }

  // Particle model: slow upward drift, slight horizontal meander, copper glow
  const COUNT = Math.min(140, Math.round((w*h)/18000));
  const particles = new Array(COUNT).fill(0).map(seed);

  // Trail buffer for gentle smears
  ctx.globalCompositeOperation = 'source-over';
  let raf = 0;

  function seed(){
    return {
      x: Math.random()*w,
      y: h + Math.random()*h*.35,
      vx: (Math.random()-.5)*0.22,
      vy: - (0.28 + Math.random()*0.55),
      r: 0.6 + Math.random()*1.9,
      a: 0.35 + Math.random()*0.45,
      hue: 28 + Math.random()*12, // coppery range
      tail: []  // recent positions for light trail
    };
  }

  function step(){
    // Faint fade to create trails
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0,0,w,h);

    // Additive glow for embers
    ctx.globalCompositeOperation = 'lighter';

    for(const p of particles){
      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.vx += (Math.random()-.5)*0.02; // subtle meander

      // Wrap/respawn
      if(p.y < -16 || p.x < -16 || p.x > w+16){
        Object.assign(p, seed(), { y: h+8 });
      }

      // Store tail points
      p.tail.push({x:p.x, y:p.y});
      if(p.tail.length > 10) p.tail.shift();

      // Trail gradient
      if(p.tail.length > 2){
        ctx.beginPath();
        for(let i=0;i<p.tail.length;i++){
          const tp = p.tail[i];
          if(i===0) ctx.moveTo(tp.x, tp.y); else ctx.lineTo(tp.x, tp.y);
        }
        ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, ${p.a*0.25})`;
        ctx.lineWidth = Math.max(1, p.r*0.6);
        ctx.stroke();
      }

      // Ember glow
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r*5.5);
      grad.addColorStop(0, `hsla(${p.hue}, 85%, 62%, ${p.a})`);
      grad.addColorStop(1, `hsla(${p.hue}, 85%, 62%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
  }

  function frame(){ raf = requestAnimationFrame(frame); step(); }
  frame();

  function resize(){
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  return { stop(){ cancelAnimationFrame(raf); }, resize };
}
