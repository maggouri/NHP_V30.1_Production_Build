var e,t;"function"==typeof(e=globalThis.define)&&(t=e,e=null),function(t,l,o,n,r){var a="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},i="function"==typeof a[n]&&a[n],s=i.cache||{},c="undefined"!=typeof module&&"function"==typeof module.require&&module.require.bind(module);function d(e,l){if(!s[e]){if(!t[e]){var o="function"==typeof a[n]&&a[n];if(!l&&o)return o(e,!0);if(i)return i(e,!0);if(c&&"string"==typeof e)return c(e);var r=Error("Cannot find module '"+e+"'");throw r.code="MODULE_NOT_FOUND",r}p.resolve=function(l){var o=t[e][1][l];return null!=o?o:l},p.cache={};var m=s[e]=new d.Module(e);t[e][0].call(m.exports,p,m,m.exports,this)}return s[e].exports;function p(e){var t=p.resolve(e);return!1===t?{}:d(t)}}d.isParcelRequire=!0,d.Module=function(e){this.id=e,this.bundle=d,this.exports={}},d.modules=t,d.cache=s,d.parent=i,d.register=function(e,l){t[e]=[function(e,t){t.exports=l},{}]},Object.defineProperty(d,"root",{get:function(){return a[n]}}),a[n]=d;for(var m=0;m<l.length;m++)d(l[m]);if(o){var p=d(o);"object"==typeof exports&&"undefined"!=typeof module?module.exports=p:"function"==typeof e&&e.amd?e(function(){return p}):r&&(this[r]=p)}}({"4lUfz":[function(e,t,l){var o=e("@parcel/transformer-js/src/esmodule-helpers.js");o.defineInteropFlag(l),o.export(l,"calculateLevel",()=>a),o.export(l,"getTotalSalesQuantity",()=>i),o.export(l,"createLevelBadge",()=>s),o.export(l,"createLevelUpModal",()=>c),o.export(l,"playLevelUpSound",()=>d),o.export(l,"checkLevelUp",()=>p),o.export(l,"showLevelUpModal",()=>g),o.export(l,"injectLevelStyles",()=>u);let n="#10b981",r=[{sales:5e4,image:"50000.png",name:"Legendary Master",color:n},{sales:2e4,image:"20000.png",name:"Elite Pro",color:n},{sales:15e3,image:"15000.png",name:"Master Pro",color:n},{sales:1e4,image:"10000.png",name:"Pro",color:n},{sales:8e3,image:"8000.png",name:"Expert IV",color:n},{sales:7e3,image:"7000.png",name:"Expert III",color:n},{sales:5e3,image:"5000.png",name:"Expert II",color:n},{sales:4e3,image:"4000.png",name:"Expert I",color:n},{sales:3e3,image:"3000.png",name:"Advanced IV",color:n},{sales:2200,image:"2200.png",name:"Advanced III",color:n},{sales:1800,image:"1800.png",name:"Advanced II",color:n},{sales:1400,image:"1400.png",name:"Advanced I",color:n},{sales:1e3,image:"1000.png",name:"Intermediate IV",color:n},{sales:800,image:"800.png",name:"Intermediate III",color:n},{sales:500,image:"500.png",name:"Intermediate II",color:n},{sales:300,image:"300.png",name:"Intermediate I",color:n},{sales:200,image:"200.png",name:"Beginner V",color:n},{sales:150,image:"150.png",name:"Beginner IV",color:n},{sales:100,image:"100.png",name:"Beginner III",color:n},{sales:30,image:"30.png",name:"Beginner II",color:n},{sales:10,image:"10.png",name:"Beginner I",color:n}];function a(e){let t=r[r.length-1],l=r.length>1?r[r.length-2]:null;for(let o=0;o<r.length;o++){let n=r[o],a=o<r.length-1?r[o+1].sales:0;if(e>=a&&e<=n.sales){t=n,l=o>0?r[o-1]:null;break}}e>r[0].sales&&(t=r[0],l=null);let o=0,n=0,a=0,i=0;return l?(o=(e-(a=10===t.sales?0:r.findIndex(e=>e.sales===t.sales)<r.length-1?r[r.findIndex(e=>e.sales===t.sales)+1].sales:0))/(t.sales-a)*100,i=t.sales-e):(o=100,i=0),{current:t,next:l,totalSales:e,progress:Math.min(Math.max(o,0),100),salesRemaining:i}}async function i(){return new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},l=>{if(chrome.runtime.lastError){t(chrome.runtime.lastError);return}let o=l?.works||[],n=o.reduce((e,t)=>e+(t.totalQuantity||0),0);e(n)})})}function s(e){let t=document.createElement("div");t.className="merchghost-level-badge",t.style.setProperty("--level-color",e.current.color);let l=e.current.image?chrome.runtime.getURL(`assets/level/${e.current.image}`):"";return t.innerHTML=`
    <div class="level-display-compact">
      <div class="level-circle-container">
        ${function(e,t){let l=2*Math.PI*85;return`
    <svg class="level-progress-ring" width="200" height="200" viewBox="0 0 200 200">
      <!-- Background Circle -->
      <circle
        cx="100" cy="100" r="85"
        fill="none"
        stroke="#e0e0e0"
        stroke-width="12"
      />
      <!-- Progress Circle -->
      <circle
        cx="100" cy="100" r="85"
        fill="none"
        stroke="${t}"
        stroke-width="12"
        stroke-dasharray="${l}"
        stroke-dashoffset="${l-e/100*l}"
        stroke-linecap="round"
        transform="rotate(-90 100 100)"
        class="level-progress-circle-animate"
      />
    </svg>
  `}(e.next?e.progress:100,e.current.color)}
        ${l?`<img src="${l}" class="level-icon-compact" alt="Level ${e.current.sales}">`:""}
      </div>
      <div class="level-text-compact">
        <strong>LEVEL: ${0===e.current.sales?"10":e.current.sales.toLocaleString()}</strong>
      </div>
      ${e.next?`
        <div class="level-progress-bar-compact">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${e.progress}%; background: ${e.current.color};"></div>
          </div>
          <div class="progress-text-compact">
            ${e.salesRemaining.toLocaleString()} sales to Level ${e.next.sales.toLocaleString()}
          </div>
        </div>
      `:`
        <div class="max-level-badge">\ud83c MAX LEVEL</div>
      `}
    </div>
  `,t}async function c(e){let t=document.createElement("div");t.id="merchghost-level-up-modal",t.className="merchghost-level-up-modal";let l=chrome.runtime.getURL("assets/big-red-button.png"),o=chrome.runtime.getURL("assets/hand-cursor.png"),n=chrome.runtime.getURL("assets/Lightogo-footer@2x.png");try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";n="dark"===t?chrome.runtime.getURL("assets/Darklogo-footer@2x.png"):chrome.runtime.getURL("assets/Lightogo-footer@2x.png")}catch(e){}t.innerHTML=`
    <div class="level-modal-backdrop"></div>
    <div class="level-modal-content-new">
      <!-- Header -->
      <div class="level-modal-header-new">
        <button class="level-modal-close-btn" id="level-modal-close-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="pointer-events: none;">
            <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      
      <!-- Stage 1: Button -->
      <div class="level-stage-1">
        <h2 style="color: #111827; font-size: 20px; margin-bottom: 16px; font-weight: 600;">A new Tier<br/>is waiting for you!</h2>
        <div class="red-button-container">
          <img src="${l}" class="red-button" alt="Reveal New Tier">
          <img src="${o}" class="hand-cursor" alt="Click">
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 15px;">Click to reveal your new tier</p>
      </div>
      
      <!-- Stage 2: Counter (Hidden initially) -->
      <div class="level-stage-2" style="display: none;">
        <div class="counter-display">0</div>
      </div>
      
      <!-- Stage 3: Congratulations (Hidden initially) -->
      <div class="level-stage-3" style="display: none;">
        <h2 style="color: #111; font-size: 24px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
          Congratulations
          <img src="${chrome.runtime.getURL("assets/Group.png")}" alt="?" class="congrats-question-icon">
        </h2>
        <div class="level-icon-final-container">
          <!-- \u0627\u0644\u0623\u064a\u0642\u0648\u0646\u0629 \u0633\u062a\u0636\u0627\u0641 \u0647\u0646\u0627 \u062f\u064a\u0646\u0627\u0645\u064a\u0643\u064a\u0627\u064b -->
        </div>
        <div class="level-number-final">${e.current.sales.toLocaleString()}</div>
        <div class="level-name-final">UNLOCKED LEVEL ${e.current.sales.toLocaleString()}</div>
      </div>
      
      <!-- Logo \u0641\u064a \u0627\u0644\u0623\u0633\u0641\u0644 -->
      <div class="level-modal-footer">
        <img src="${n}" alt="MerchGhost" class="level-modal-logo">
      </div>
    </div>
  `;let r=t.querySelector("#level-modal-close-btn"),a=t.querySelector(".red-button-container"),i=t.querySelector(".hand-cursor"),s=t.querySelector(".level-stage-1"),c=t.querySelector(".level-stage-2"),m=t.querySelector(".level-stage-3"),p=t.querySelector(".counter-display"),g=t.querySelector(".level-icon-final-container");return r?.addEventListener("click",()=>{t.remove()}),r?.addEventListener("mouseover",()=>{r.style.background="#e5e7eb"}),r?.addEventListener("mouseout",()=>{r.style.background="#f3f4f6"}),a?.addEventListener("mousemove",e=>{let t=a.getBoundingClientRect(),l=e.clientX-t.left,o=e.clientY-t.top;i&&(i.style.left=`${l}px`,i.style.top=`${o}px`,i.style.transform="translate(-50%, -50%)")}),a?.addEventListener("mouseleave",()=>{i&&(i.style.left="",i.style.top="",i.style.transform="")}),a?.addEventListener("click",()=>{s.style.display="none",c.style.display="flex";let l=e.current.sales,o=l/60,n=0,r=setInterval(()=>{(n+=o)>=l&&(n=l,clearInterval(r),setTimeout(()=>{c.style.display="none",m.style.display="flex";let l=e.current.image?chrome.runtime.getURL(`assets/level/${e.current.image}`):"";l&&(g.innerHTML=`<img src="${l}" class="level-icon-final" alt="Level ${e.current.sales}">`);let o=t.querySelector(".level-modal-content-new");o&&setTimeout(()=>{(function(e){let t=chrome.runtime.getURL("assets/celebration.gif"),l=e.querySelector("#celebration-gif");l&&l.remove();let o=document.createElement("img");o.id="celebration-gif",o.src=t,o.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:1000;border-radius:12px;",e.appendChild(o),setTimeout(()=>{o.parentNode&&o.remove()},4e3)})(o),d()},300)},500)),p.textContent=Math.floor(n).toString()},2e3/60)}),t}function d(){try{let e=new Audio(chrome.runtime.getURL("assets/sounds/cha-ching.mp3"));e.volume=.5,e.play().catch(()=>{})}catch(e){}}let m=!1;async function p(e){try{let t=a(e),l=await chrome.storage.local.get(["currentLevel","levelUpShownAt"]),o=l.currentLevel;if(null==o){if(t.current.sales>10){let e=`${t.current.sales}-10`;await chrome.storage.local.set({currentLevel:t.current.sales,levelUpDate:new Date().toISOString(),levelUpShownAt:e}),m||g(t).catch(()=>{})}else await chrome.storage.local.set({currentLevel:t.current.sales,levelUpDate:new Date().toISOString()});return}if(t.current.sales>o){let e=`${t.current.sales}-${o}`,n=l.levelUpShownAt;n===e||(await chrome.storage.local.set({currentLevel:t.current.sales,levelUpDate:new Date().toISOString(),levelUpShownAt:e}),m||g(t).catch(()=>{}))}}catch(e){}}async function g(e){let t=document.getElementById("merchghost-level-up-modal");t&&t.remove();let l=await c(e);document.body.appendChild(l),setTimeout(async()=>{try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";"dark"===t&&l.classList.add("dark-mode")}catch(e){}},50),setTimeout(()=>{l.classList.add("show"),m=!0},100),setTimeout(()=>{m=!1},5e3)}function u(){if(document.getElementById("merchghost-level-styles"))return;let e=document.createElement("style");e.id="merchghost-level-styles",e.textContent=`
    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       Level Badge (Compact - \u0644\u0644\u062f\u0627\u0634\u0628\u0648\u0631\u062f)
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    
    .merchghost-level-badge {
      display: inline-block;
      padding: 15px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border: 1px solid #e0e0e0;
    }
    
    .level-display-compact {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    
    .level-circle-container {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .level-progress-ring {
      width: 100%;
      height: 100%;
    }
    
    .level-icon-compact {
      position: absolute;
      width: 80px;
      height: 80px;
      object-fit: contain;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    
    .level-text-compact {
      font-size: 18px;
      font-weight: 700;
      color: #333;
      text-align: center;
      letter-spacing: 1px;
    }
    
    .level-progress-bar-compact {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .progress-bar-bg {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-bar-fill {
      height: 100%;
      background: var(--level-color, #4CAF50);
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    
    .progress-text-compact {
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    
    .max-level-badge {
      font-size: 14px;
      font-weight: 600;
      color: #FFD700;
      text-align: center;
    }
    
    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       Level Up Modal (NEW DESIGN - \u0645\u062b\u0644 PrettyMerch)
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    
    .merchghost-level-up-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 999999;
      display: none;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .merchghost-level-up-modal.show {
      display: flex;
      opacity: 1;
    }
    
    .level-modal-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
    }
    
    .level-modal-content-new {
      position: relative;
      background: white;
      border: 2px solid #10b981;
      border-radius: 12px;
      padding: 24px;
      max-width: 450px;
      width: 90%;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      animation: modal-fade-in 0.3s ease;
      display: flex;
      flex-direction: column;
    }
    
    /* Dark Mode Support */
    .merchghost-level-up-modal.dark-mode .level-modal-content-new {
      background: #0a0a0a !important;
      border: 2px solid #10b981 !important;
      color: #e5e5e5 !important;
    }
    
    .merchghost-level-up-modal.dark-mode .level-modal-content-new h2,
    .merchghost-level-up-modal.dark-mode .level-modal-content-new p,
    .merchghost-level-up-modal.dark-mode .level-modal-content-new div,
    .merchghost-level-up-modal.dark-mode .level-modal-content-new span {
      color: #e5e5e5 !important;
    }
    
    .merchghost-level-up-modal.dark-mode .level-modal-content-new [style*="color: #111827"],
    .merchghost-level-up-modal.dark-mode .level-modal-content-new [style*="color: #111"],
    .merchghost-level-up-modal.dark-mode .level-modal-content-new [style*="color: #333"] {
      color: #e5e5e5 !important;
    }
    
    .merchghost-level-up-modal.dark-mode .level-modal-content-new [style*="color: #999"] {
      color: #b0b0b0 !important;
    }
    
    .merchghost-level-up-modal.dark-mode .level-modal-close-btn {
      background: #1a1a1a !important;
      color: #e5e5e5 !important;
    }
    
    .merchghost-level-up-modal.dark-mode .level-modal-close-btn:hover {
      background: #2a2a2a !important;
    }
    
    .merchghost-level-up-modal.dark-mode .level-modal-close-btn svg path {
      stroke: #e5e5e5 !important;
    }
    
    .merchghost-level-up-modal.dark-mode .level-number-final,
    .merchghost-level-up-modal.dark-mode .level-name-final,
    .merchghost-level-up-modal.dark-mode .counter-display {
      color: #e5e5e5 !important;
    }
    
    @keyframes modal-fade-in {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    
    .level-modal-header-new {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 0;
      margin-bottom: 0;
    }
    
    .level-modal-close-btn {
      background: #f3f4f6;
      border: none;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      padding: 0;
      flex-shrink: 0;
    }
    
    /* Stage 1: Red Button */
    .level-stage-1 {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .red-button-container {
      position: relative;
      width: 200px;
      height: 200px;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    
    .red-button-container:hover {
      transform: scale(1.05);
    }
    
    .red-button-container:active {
      transform: scale(0.95);
    }
    
    .red-button {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .hand-cursor {
      position: absolute;
      width: 50px;
      height: 50px;
      bottom: 10%;
      right: 10%;
      pointer-events: none;
      transition: none;
      z-index: 10;
    }
    
    /* Stage 2: Counter */
    .level-stage-2 {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 250px;
    }
    
    .counter-display {
      font-size: 120px;
      font-weight: 900;
      color: #111827;
      line-height: 1;
    }
    
    /* Stage 3: Congratulations */
    .level-stage-3 {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0;
      width: 100%;
    }
    
    .level-stage-3 h2 {
      margin-bottom: 20px !important;
      margin-top: 0 !important;
    }
    
    .level-icon-final-container {
      width: 150px;
      height: 150px;
      margin: 0 0 20px 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .level-icon-final {
      width: 100%;
      height: 100%;
      object-fit: contain;
      animation: icon-pop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }
    
    @keyframes icon-pop {
      0% {
        transform: scale(0) rotate(-180deg);
        opacity: 0;
      }
      60% {
        transform: scale(1.2) rotate(10deg);
      }
      100% {
        transform: scale(1) rotate(0deg);
        opacity: 1;
      }
    }
    
    .level-number-final {
      font-size: 56px;
      font-weight: 900;
      color: #111827;
      margin: 0 0 12px 0;
      line-height: 1;
    }
    
    .level-name-final {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      letter-spacing: 2px;
      margin: 0;
    }
    
    .congrats-question-icon {
      display: inline-block;
      width: 18px;
      height: 18px;
      margin-left: 6px;
      object-fit: contain;
      vertical-align: middle;
    }
    
    .level-modal-footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #eee;
      text-align: left;
    }
    
    .level-modal-logo {
      height: 35px;
    }
    
    #celebration-gif {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      z-index: 1000;
      border-radius: 12px;
    }
  `,document.head.appendChild(e)}},{"@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}],fRZO2:[function(e,t,l){l.interopDefault=function(e){return e&&e.__esModule?e:{default:e}},l.defineInteropFlag=function(e){Object.defineProperty(e,"__esModule",{value:!0})},l.exportAll=function(e,t){return Object.keys(e).forEach(function(l){"default"===l||"__esModule"===l||t.hasOwnProperty(l)||Object.defineProperty(t,l,{enumerable:!0,get:function(){return e[l]}})}),t},l.export=function(e,t,l){Object.defineProperty(e,t,{enumerable:!0,get:l})}},{}]},["4lUfz"],"4lUfz","parcelRequire4b19"),globalThis.define=t;