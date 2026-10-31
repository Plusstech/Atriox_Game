import{A as y,B as f,a as r}from"./index-BnUkj0eO.js";import"./phaser-0YPJO2g1.js";function g(a){const i=document.createElement("div");i.id="dev-panel",i.hidden=!0,document.body.appendChild(i);const o=()=>{const e=a.scene.getScene("ArenaScene");return e&&e.sys.isActive()&&e.player?e:null};let d=null;i.innerHTML=`
    <h3>ATRIOX · DEV (F2)</h3>
    <div><b>Animações</b> <small>(força estado)</small></div>
    <div class="row" id="dv-anims"></div>
    <button id="dv-free">liberar animação</button>
    <label>Escala do sprite <input id="dv-scale" type="range" min="0.25" max="0.8" step="0.01"></label>
    <label>Velocidade das animações <span id="dv-speed-v"></span><input id="dv-speed" type="range" min="0.1" max="2" step="0.05" value="1"></label>
    <label><input id="dv-hit" type="checkbox"> hitboxes / origens</label>
    <label><input id="dv-god" type="checkbox"> modo deus</label>
    <div><b>Partida</b></div>
    <div class="row">
      <button id="dv-kill">matar inimigos</button>
      <button id="dv-toknar">ir: Toknar</button><button id="dv-build">build completa</button><button id="dv-eternity">Eternidade</button>
      <button id="dv-exec">ir: Carrasco</button>
      <button id="dv-nemeia">ir: Caim</button>
      <button id="dv-wyv">ir: Ninho das Wyverns</button>
      <button id="dv-selun">ir: Sêlun</button>
      <button id="dv-goblin">+ goblin</button><button id="dv-orc">+ orc</button><button id="dv-wild">+ wyvern selvagem</button>
      <button id="dv-boss50">chefe −50%</button>
      <button id="dv-heal">curar</button>
      <button id="dv-pool">poça no jogador</button>
      <button id="dv-insp">inspetor de animações</button>
    </div>
    <div><b>Dons de Apollon</b></div>
    <div class="row" id="dv-gifts"></div>
    <div><b>Bênçãos</b></div>
    <div class="row" id="dv-bless"></div>
    <pre id="dv-info" style="white-space:pre-wrap;margin:6px 0 0;color:#a89878"></pre>
  `;const t=e=>i.querySelector(`#${e}`),v=t("dv-anims");for(const e of y){const n=document.createElement("button");n.textContent=e,n.onclick=()=>{d=e},v.appendChild(n)}const p=t("dv-bless");for(const e of f){const n=document.createElement("button");n.textContent=e.name,n.onclick=()=>o()?.applyBlessing(e.id),p.appendChild(n)}t("dv-free").onclick=()=>{d=null};const l=t("dv-scale");l.oninput=()=>{const e=o();e&&(e.player.animator.baseScale=Number(l.value))};const s=t("dv-speed");s.oninput=()=>{const e=o();e&&(e.player.animator.speed=Number(s.value)),t("dv-speed-v").textContent=`×${s.value}`},t("dv-hit").onchange=e=>{const n=o();n&&(n.showHitboxes=e.target.checked)},t("dv-god").onchange=e=>{const n=o();n&&(n.player.godMode=e.target.checked)},t("dv-kill").onclick=()=>o()?.devKillAll(),t("dv-toknar").onclick=()=>o()?.devGotoRoom("toknar"),t("dv-build").onclick=()=>{const e=o();if(e)for(const n of r.filter(m=>!m.id.startsWith("universal")))e.applyGift(n.id)},t("dv-eternity").onclick=()=>o()?.startEndless(),t("dv-exec").onclick=()=>o()?.devGotoRoom("executioner"),t("dv-nemeia").onclick=()=>o()?.devGotoRoom("nemeia"),t("dv-pool").onclick=()=>o()?.devSpawnPoolAtPlayer(),t("dv-wyv").onclick=()=>o()?.devGotoRoom("build-2"),t("dv-selun").onclick=()=>o()?.devStartSelun();const c=()=>{const e=o();return e?{x:e.player.x+260,y:e.player.y-60}:null};t("dv-goblin").onclick=()=>{const e=c();e&&o()?.spawnEnemy("goblin",e.x,e.y)},t("dv-orc").onclick=()=>{const e=c();e&&o()?.spawnEnemy("orc",e.x,e.y)},t("dv-wild").onclick=()=>{const e=c();e&&o()?.spawnWyvern(e.x,e.y,"wild")},t("dv-insp").onclick=()=>{for(const e of["ArenaScene","UIScene","MenuScene"])a.scene.isActive(e)&&a.scene.stop(e);a.scene.start("AnimInspectorScene")};const u=t("dv-gifts");for(const e of r){const n=document.createElement("button");n.textContent=e.name,n.onclick=()=>o()?.applyGift(e.id),u.appendChild(n)}t("dv-boss50").onclick=()=>o()?.devDamageBoss(.5),t("dv-heal").onclick=()=>{o()?.player.heal(999)};const b=e=>{if(e.code==="F2"||e.code==="Backquote"){e.preventDefault(),i.hidden=!i.hidden;const n=o();n&&(l.value=String(n.player.animator.baseScale))}};window.addEventListener("keydown",b),a.events.on("poststep",()=>{const e=o();if(!e||i.hidden)return;d&&(e.player.animator.set(d),e.player.animator.attackPhase="active",e.player.animator.phaseT=.5,e.player.animator.update(0,e.player.x,e.player.y,e.player.y));const n=e.debugSnapshot();t("dv-info").textContent=`fps ${Math.round(a.loop.actualFps)}
anim ${e.player.animator.state}
${JSON.stringify(n,null,1).slice(0,600)}`})}export{g as attachDevPanel};
