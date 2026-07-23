var e,t;"function"==typeof(e=globalThis.define)&&(t=e,e=null),function(t,o,r,i,l){var a="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},n="function"==typeof a[i]&&a[i],s=n.cache||{},d="undefined"!=typeof module&&"function"==typeof module.require&&module.require.bind(module);function c(e,o){if(!s[e]){if(!t[e]){var r="function"==typeof a[i]&&a[i];if(!o&&r)return r(e,!0);if(n)return n(e,!0);if(d&&"string"==typeof e)return d(e);var l=Error("Cannot find module '"+e+"'");throw l.code="MODULE_NOT_FOUND",l}g.resolve=function(o){var r=t[e][1][o];return null!=r?r:o},g.cache={};var p=s[e]=new c.Module(e);t[e][0].call(p.exports,g,p,p.exports,this)}return s[e].exports;function g(e){var t=g.resolve(e);return!1===t?{}:c(t)}}c.isParcelRequire=!0,c.Module=function(e){this.id=e,this.bundle=c,this.exports={}},c.modules=t,c.cache=s,c.parent=n,c.register=function(e,o){t[e]=[function(e,t){t.exports=o},{}]},Object.defineProperty(c,"root",{get:function(){return a[i]}}),a[i]=c;for(var p=0;p<o.length;p++)c(o[p]);if(r){var g=c(r);"object"==typeof exports&&"undefined"!=typeof module?module.exports=g:"function"==typeof e&&e.amd?e(function(){return g}):l&&(this[l]=g)}}({cl0TT:[function(e,t,o){var r=e("@parcel/transformer-js/src/esmodule-helpers.js");r.defineInteropFlag(o),r.export(o,"createMerchGhostDashboardContent",()=>a),r.export(o,"insertDashboardIntoDOM",()=>G),r.export(o,"removeDashboardFromDOM",()=>V),r.export(o,"initAutoRefresh",()=>K);var i=e("../lib/utils"),l=e("./level-system");function a(){if(!document.getElementById("screenshot-mode-style")){let e=document.createElement("style");e.id="screenshot-mode-style",e.textContent=`
      .blur-contents {
        filter: blur(5px);
        -webkit-filter: blur(5px);
        transition: filter 0.3s ease;
      }
      .screenshot-switch-wrapper {
        position: absolute;
        right: 0;
        bottom: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        z-index: 10;
      }
      .screenshot-switch-wrapper.inline-flex {
        position: static;
      }
      .screenshot-switch-container {
        position: relative;
        width: 40px;
        height: 20px;
      }
      .screenshot-switch-input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }
      .screenshot-switch-label {
        display: block;
        width: 40px;
        height: 20px;
        background-color: #ccc;
        border-radius: 20px;
        cursor: pointer;
        position: relative;
        transition: background-color 0.3s ease;
      }
      .screenshot-switch-label::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: white;
        top: 2px;
        left: 2px;
        transition: transform 0.3s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      .screenshot-switch-input:checked + .screenshot-switch-label {
        background-color: #10b981;
      }
      .screenshot-switch-input:checked + .screenshot-switch-label::after {
        transform: translateX(20px);
      }
      .screenshot-switch-icon {
        width: 14px;
        height: 14px;
        cursor: help;
        margin-right: 3px;
        object-fit: contain;
      }
    `,document.head.appendChild(e)}let e=e=>{try{localStorage.setItem("merchghost_screenshot_mode",e?"true":"false")}catch(e){}let t=document.querySelectorAll(".hide-titles");t.forEach(t=>{t.checked=e});let o=document.querySelectorAll(".hide-in-screenshot");o.forEach(t=>{e?t.classList.add("blur-contents"):t.classList.remove("blur-contents")})},t=()=>{try{let e=localStorage.getItem("merchghost_screenshot_mode");return"true"===e}catch(e){return!1}};t(),window.__screenshotModeHandlerAdded||(document.addEventListener("change",function(t){let o=t.target;if(o.classList.contains("hide-titles")){let t=o.checked;e(t)}}),window.__screenshotModeHandlerAdded=!0,window.__applyScreenshotMode=e,window.__getSavedScreenshotMode=t);let o=document.createElement("div");o.id="merchghost-dashboard-wrapper",o.style.cssText=`
    min-height: calc(100vh - 101px);
    margin: 0;
    font-family: 'Lato', sans-serif;
    color: #313131;
    background: white;
    position: relative;
    z-index: 1;
    pointer-events: auto;
  `;let r=document.createElement("div");r.id="merchghost-dashboard-container",r.className="merchghost-container",r.style.cssText=`
    width: 1220px;
    min-width: 1220px;
    max-width: 1220px;
    margin: 0 auto;
    padding: 0;
  `;let i=document.createElement("div");i.id="merchghost-dashboard-content",i.className="merchghost-content",i.style.cssText=`
    width: 100%;
    min-height: 100%;
    padding: 0 20px 20px 20px;
  `;let l=function(){let e=document.createElement("div");e.style.cssText=`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
    border-bottom: 2px solid #10b981;
  `;let t=document.createElement("div");t.className="nav nav-tabs pm_custom_tabs",t.style.cssText=`
    display: flex;
    position: relative;
    flex: 1;
    border-bottom: none;
    clear: both;
  `,e.appendChild(t);let o=document.createElement("img");return T().then(e=>{o.src=e}),o.alt="MerchGhost",o.style.cssText=`
    height: 28px;
    width: auto;
    flex-shrink: 0;
  `,e.appendChild(o),[{name:"Dashboard",icon:"\uD83D\uDDA5\ufe0f",id:"nav-dashboard-tab",href:"#nav-dashboard"},{name:"design",icon:"\u2630",id:"nav-design-tab",href:"#nav-design"},{name:"creat",icon:"\u2795",id:"nav-creat-tab",href:"#nav-creat"}].forEach((e,o)=>{let r=document.createElement("a");if(r.id=e.id,r.className=`nav-item nav-link ${0===o?"active show":""}`,r.setAttribute("data-toggle","tab"),"nav-creat-tab"===e.id?(r.href="https://www.redbubble.com/portfolio/images/new?ref=account-nav-dropdown",r.setAttribute("target","_blank"),r.setAttribute("rel","noopener"),r.setAttribute("aria-label","Create")):r.href=e.href,r.style.cssText=`
      padding: 12px 20px;
      color: ${0===o?"#495057":"#6c757d"};
      background-color: ${0===o?"#fff":"transparent"};
      border: ${0===o?"2px solid #10b981":"2px solid transparent"};
      border-bottom: ${0===o?"none":"2px solid transparent"};
      border-radius: ${0===o?"4px 4px 0 0":"0"};
      cursor: pointer;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: -2px;
      position: relative;
      z-index: ${0===o?"2":"1"};
      font-size: 14px;
      font-weight: ${0===o?"600":"400"};
    `,"nav-dashboard-tab"===e.id){let e=document.createElement("img");M().then(t=>{e.src=t}),e.alt="Dashboard",e.style.cssText="width: 14px; height: 14px; object-fit: contain; opacity: 0.6; filter: grayscale(1) brightness(0.6); display: inline-block;",r.appendChild(e)}else if("nav-creat-tab"===e.id){let e=document.createElement("img");e.src=chrome.runtime.getURL("assets/Uploadnew.png"),e.alt="Create",e.style.cssText="width: 18px; height: 18px; object-fit: contain; display: inline-block;",r.appendChild(e)}else{let t=document.createElement("span");t.style.cssText="font-size: 14px; display: inline-block;",t.textContent=e.icon,r.appendChild(t)}let i=document.createElement("span");i.textContent=e.name,"nav-creat-tab"!==e.id&&r.appendChild(i),t.appendChild(r)}),e}();i.appendChild(l);let a=document.createElement("div");a.id="merchghost-content-container",i.appendChild(a),n(a).catch(()=>{}),setTimeout(()=>{U()},100),setTimeout(()=>{(function(e){let t=[{id:"nav-dashboard-tab",tabName:"dashboard"},{id:"nav-design-tab",tabName:"design"},{id:"nav-creat-tab",tabName:"creat"}];t.forEach(o=>{let r=document.getElementById(o.id);r&&r.addEventListener("click",i=>{if("creat"===o.tabName){i.preventDefault(),i.stopPropagation();try{window.open("https://www.redbubble.com/portfolio/images/new?ref=account-nav-dropdown","_blank","noopener")}catch{}return}switch(i.preventDefault(),i.stopPropagation(),t.forEach(e=>{let t=document.getElementById(e.id);t&&(t.classList.remove("active","show"),t.style.color="#6c757d",t.style.backgroundColor="transparent",t.style.border="2px solid transparent",t.style.borderBottom="2px solid transparent",t.style.fontWeight="400",t.style.zIndex="1")}),r.classList.add("active","show"),r.style.color="#495057",r.style.backgroundColor="#fff",r.style.border="2px solid #dee2e6",r.style.borderBottom="none",r.style.borderRadius="4px 4px 0 0",r.style.fontWeight="600",r.style.zIndex="2",o.tabName){case"dashboard":n(e).catch(()=>{});break;case"design":s(e);break;case"creat":(function(e){for(;e.firstChild;)e.removeChild(e.firstChild);e.innerHTML="",e.innerHTML=`
    <div style="padding: 40px; text-align: center; color: #666;">
      <h2 style="font-size: 24px; margin-bottom: 10px;">\u2795 Creat</h2>
      <p style="font-size: 16px;">Creat content will be here...</p>
    </div>
  `})(e)}})})})(a)},100);let d=function(){let e=document.createElement("div");e.id="merchghost-footer",e.style.cssText=`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 0;
    margin-top: 40px;
    border-top: 1px solid #e5e7eb;
    font-family: 'Lato', sans-serif;
  `;let t=document.createElement("div");t.style.cssText=`
    display: flex;
    align-items: center;
    gap: 12px;
  `;let o=document.createElement("img");T().then(e=>{o.src=e}),o.alt="MerchGhost",o.style.cssText=`
    height: 24px;
    width: auto;
  `,t.appendChild(o);let r=document.createElement("span");r.textContent="v1.5.4",r.style.cssText=`
    color: #6b7280;
    font-size: 13px;
    font-weight: 400;
  `,t.appendChild(r),e.appendChild(t);let i=document.createElement("div");i.style.cssText=`
    display: flex;
    align-items: center;
    gap: 20px;
  `;let l=document.createElement("a");l.href="mailto:support@merchghost.com",l.style.cssText=`
    color: #10b981;
    text-decoration: none;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    transition: opacity 0.2s;
  `,l.addEventListener("mouseenter",()=>{l.style.opacity="0.7"}),l.addEventListener("mouseleave",()=>{l.style.opacity="1"});let a=document.createElement("span");a.innerHTML="&#9993;",a.style.cssText="font-size: 13px; color: #10b981; line-height: 1; margin-right: 2px;",l.appendChild(a);let n=document.createTextNode("support@merchghost.com");l.appendChild(n),i.appendChild(l);let s=document.createElement("a");s.href="#",s.style.cssText=`
    color: #10b981;
    text-decoration: none;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    transition: opacity 0.2s;
  `,s.addEventListener("mouseenter",()=>{s.style.opacity="0.7"}),s.addEventListener("mouseleave",()=>{s.style.opacity="1"}),s.addEventListener("click",e=>{e.preventDefault(),z()});let d=document.createElement("span");d.innerHTML="&#9881;",d.style.cssText="font-size: 13px; color: #10b981; line-height: 1; margin-right: 2px;",s.appendChild(d);let c=document.createTextNode("Options");return s.appendChild(c),i.appendChild(s),e.appendChild(i),e}();return i.appendChild(d),r.appendChild(i),o.appendChild(r),o}async function n(e){for(;e.firstChild;)e.removeChild(e.firstChild);e.innerHTML="";try{let t=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getMetadata",key:"initialSyncCompleted"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),o=t&&t.success&&"true"===t.value;if(o&&(chrome.runtime.sendMessage({action:"updateBadge"},e=>{chrome.runtime.lastError||e&&e.success}),chrome.runtime.sendMessage({action:"checkNewWorks"},e=>{chrome.runtime.lastError||e&&e.success&&setTimeout(()=>{X()},2e3)})),!o){let t=document.createElement("div");t.style.cssText=`
    display: flex;
        flex-direction: column;
    align-items: center;
        justify-content: center;
        min-height: 400px;
        padding: 40px;
        text-align: center;
      `;let o=document.createElement("h2");o.textContent="Welcome to MerchGhost",o.style.cssText=`
        font-size: 24px;
        font-weight: 600;
        color: #333;
        margin-bottom: 16px;
        font-family: 'Lato', sans-serif;
      `;let r=document.createElement("p");r.textContent="Click the button below to start collecting your sales data from Redbubble.",r.style.cssText=`
        font-size: 16px;
        color: #666;
        margin-bottom: 32px;
        font-family: 'Lato', sans-serif;
      `;let i=document.createElement("button");i.textContent="Start",i.style.cssText=`
        background: white;
        color: #333;
        border: 1px solid #10b981;
        border-radius: 8px;
        padding: 12px 24px;
    font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        font-family: 'Lato', sans-serif;
        transition: background 0.2s, border-color 0.2s;
      `,i.addEventListener("mouseenter",()=>{i.style.background="#ecfdf5",i.style.borderColor="#10b981"}),i.addEventListener("mouseleave",()=>{i.style.background="white",i.style.borderColor="#10b981"}),i.addEventListener("click",async()=>{let o=chrome.runtime.getURL("assets/building.gif");t.innerHTML=`
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; padding: 40px; text-align: center;">
            <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 20px; font-family: 'Lato', sans-serif;">
              Please wait, we are collecting your data...
            </div>
            <img src="${o}" style="width: 300px; height: auto; max-width: 100%; margin-bottom: 30px;" alt="Loading">
            <div style="width: 100%; max-width: 400px;">
              <div style="width: 100%; height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; position: relative;">
                <div id="data-collection-progress" style="width: 0%; height: 100%; background: #10b981; border-radius: 4px; transition: width 0.3s ease; position: relative; overflow: hidden;">
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shimmer 2s infinite;"></div>
                </div>
              </div>
            </div>
            <style>
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            </style>
          </div>
        `;let r=t.querySelector("#data-collection-progress"),i=0,l=setInterval(()=>{i<90&&((i+=5*Math.random())>90&&(i=90),r&&(r.style.width=`${i}%`))},500);try{await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"startInitialSync"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e()})});let t=setInterval(async()=>{try{let o=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getMetadata",key:"initialSyncCompleted"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),i=o&&o.success&&"true"===o.value;i&&(clearInterval(t),clearInterval(l),r&&(r.style.width="100%"),setTimeout(()=>{n(e)},500))}catch(e){}},3e3);setTimeout(()=>{clearInterval(l)},3e5)}catch(t){clearInterval(l),n(e),alert("Error starting data collection. Please try again.")}}),t.appendChild(o),t.appendChild(r),t.appendChild(i),e.appendChild(t);return}}catch(e){}let t=document.createElement("div");t.id="merchghost-status-bar-placeholder",t.style.cssText=`
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 24px;
    align-items: start;
    padding: 16px 20px;
    background-color: #ffffff;
    border: 2px solid #10b981;
    border-radius: 8px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    min-height: 80px;
  `,e.appendChild(t),d().then(e=>{let t=document.getElementById("merchghost-status-bar-placeholder");t&&t.parentElement&&t.parentElement.replaceChild(e,t)}).catch(()=>{let e=document.getElementById("merchghost-status-bar-placeholder");e&&(e.innerHTML=`
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-weight: 600; font-size: 15px;">TIER: Unknown</span>
          <div style="width: 24px; height: 24px; background-color: #4caf50; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative;">
            <div style="width: 16px; height: 16px; background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%); border-radius: 50%; position: relative;">
              <div style="position: absolute; top: 2px; left: 2px; width: 3px; height: 3px; background: #fff; border-radius: 50%;"></div>
              <div style="position: absolute; top: 4px; left: 6px; width: 2px; height: 2px; background: #fff; border-radius: 50%;"></div>
              <div style="position: absolute; top: 6px; left: 4px; width: 2px; height: 2px; background: #fff; border-radius: 50%;"></div>
            </div>
          </div>
          <div style="width: 120px; height: 6px; background-color: #e0e0e0; border-radius: 3px; overflow: hidden;">
            <div style="width: 20%; height: 100%; background-color: #4caf50; border-radius: 3px;"></div>
          </div>
        </div>
      `)});let o=function(){let e=document.createElement("div");e.style.cssText=`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 20px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  `;let t=function(e,t){let o=document.createElement("div");o.id=t,o.style.cssText=`
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 20px;
    background-color: white;
  `;let r=document.createElement("div");return r.textContent="",r.style.cssText=`
    font-weight: bold;
    margin-bottom: 15px;
    font-size: 16px;
  `,o.appendChild(r),o}(0,"level-card");t.style.cssText=`
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 15px;
    background-color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  `,(0,l.getTotalSalesQuantity)().then(e=>{let o=(0,l.calculateLevel)(e),r=2*Math.PI*70,i=o.next?o.progress:100,a=o.current.image?chrome.runtime.getURL(`assets/level/${o.current.image}`):"";t.innerHTML=`
    <div style="text-align: center; width: 100%;">
      <div style="width: 150px; height: 150px; margin: 0 auto 8px; position: relative;">
        <svg width="150" height="150" style="transform: rotate(-90deg);">
            <circle cx="75" cy="75" r="70" fill="none" stroke="#e0e0e0" stroke-width="10"/>
            <circle cx="75" cy="75" r="70" fill="none" stroke="${o.current.color}" stroke-width="10" 
                    stroke-dasharray="${r}" stroke-dashoffset="${r-i/100*r}" stroke-linecap="round"/>
        </svg>
          ${a?`<img src="${a}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100px; height: 100px; object-fit: contain;">`:""}
      </div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 6px;">LEVEL: ${0===o.current.sales?"10":o.current.sales.toLocaleString()}</div>
        <div style="width: 100%; height: 8px; background-color: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
          <div style="width: ${i}%; height: 100%; background-color: ${o.current.color};"></div>
      </div>
        ${o.next?`
          <div style="font-size: 12px; color: #666;">
            ${o.salesRemaining.toLocaleString()} sales to Level ${o.next.sales.toLocaleString()}
          </div>
        `:`
          <div style="font-size: 12px; color: #FFD700; font-weight: 600;">
            \ud83c MAX LEVEL
          </div>
        `}
    </div>
  `}).catch(()=>{t.innerHTML=`
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 16px;">Loading Level...</div>
      </div>
    `}),e.appendChild(t);let o=p(),r=new Date(o+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}),i=document.createElement("div");i.id="today-sales-card",i.style.cssText=`
    border: 2px solid #10b981;
    border-radius: 8px;
    background-color: white;
    overflow: hidden;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  `,i.innerHTML=`
    <div style="padding: 12px 20px; border-bottom: 1px solid #d4f4dd; background: linear-gradient(to bottom, #f0fdf4, #ffffff);">
      <div style="font-weight: 600; font-size: 15px; color: #333;">Today's Sales <span style="color: #999; font-weight: 400; font-size: 13px;">${r}</span></div>
    </div>
    
    <div id="today-sales-content" style="text-align: center; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 230px;">
      <div style="font-size: 120px; font-weight: bold; color: #10b981; margin-bottom: 12px; line-height: 1;">0</div>
      
      <div style="display: flex; justify-content: space-around; align-items: center; width: 100%; padding: 0 20px;">
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          <div style="font-size: 14px; font-weight: 500; color: #333; line-height: 1.2;">$0.00</div>
          <div style="font-size: 14px; font-weight: 400; color: #999; line-height: 1.2; margin-top: 2px;">Royalties</div>
        </div>
        
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          <div style="font-size: 14px; font-weight: 500; color: #333; line-height: 1.2;">$0.00</div>
          <div style="font-size: 14px; font-weight: 400; color: #999; line-height: 1.2; margin-top: 2px;">Fees</div>
        </div>
        
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          <div style="font-size: 14px; font-weight: 500; color: #333; line-height: 1.2;">$0.00</div>
          <div style="font-size: 14px; font-weight: 400; color: #999; line-height: 1.2; margin-top: 2px;">Net Profit</div>
        </div>
      </div>
    </div>
  `,e.appendChild(i);let a=document.createElement("div");a.id="no-sales-card",a.style.cssText=`
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 15px 10px 10px 10px;
    background-color: white;
    overflow: hidden;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  `;let n=chrome.runtime.getURL("assets/building.gif");return a.innerHTML=`
    <div style="position: relative; text-align: center; padding: 0;">
      <div class="no-sales-message" style="position: relative; z-index: 10; margin-bottom: 8px;">
        <div style="font-size: 20px; font-weight: 600; border: none; margin-bottom: 6px; color: #333;">No sales yet</div>
        <div style="font-size: 14px; color: #656565; line-height: 1.5;">Hang in there... We'll notify you<br/>the moment you make a sale!</div>
      </div>
      <div style="position: relative; z-index: 1;">
        <img src="${n}" style="opacity: 0.45; width: 100%; max-width: 380px; height: auto; display: block; margin: 0 auto;">
      </div>
    </div>
  `,e.appendChild(a),setTimeout(()=>{Y(),W()},500),e}();e.appendChild(o);let r=function(){let e=document.createElement("div");return e.style.cssText=`
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 12px 15px 15px;
    background-color: white;
    margin-bottom: 20px;
    position: relative;
  `,e.innerHTML=`
    <div style="margin-bottom: 10px; text-align: center;">
      <span style="font-size: 14px; font-weight: 600; color: #555;">Sales Activity</span>
      <span style="font-size: 12px; color: #999; margin-left: 6px;">(Last 7 Days)</span>
    </div>
    <div style="position: relative; height: 240px;">
      <canvas id="sales-chart-canvas" style="cursor: pointer; width: 100%; height: 100%;"></canvas>
      <div id="chart-tooltip" style="display: none; position: absolute; background: white; border: 1px solid #ddd; border-radius: 4px; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); pointer-events: none; z-index: 1000; font-size: 12px; min-width: 140px;"></div>
    </div>
  `,setTimeout(()=>{u()},500),e}();e.appendChild(r);let i=function(){let e=document.createElement("div");e.style.cssText=`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    align-items: stretch;
  `;let t=function(){let e=document.createElement("div");if(e.id="designs-with-sales-section",e.style.cssText=`
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 20px;
    background-color: white;
    display: flex;
    flex-direction: column;
    height: 600px;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
  `,!document.getElementById("designs-with-sales-scrollbar-style")){let e=document.createElement("style");e.id="designs-with-sales-scrollbar-style",e.textContent=`
      #designs-with-sales-list::-webkit-scrollbar {
        width: 6px;
      }
      #designs-with-sales-list::-webkit-scrollbar-track {
        background: #f3f4f6;
        border-radius: 3px;
      }
      #designs-with-sales-list::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
      }
      #designs-with-sales-list::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }
      #designs-with-sales-list {
        scrollbar-width: thin;
        scrollbar-color: #d1d5db #f3f4f6;
      }
    `,document.head.appendChild(e)}e.innerHTML=`
    <div id="designs-with-sales-title" style="font-weight: 600; margin-bottom: 10px; font-size: 15px; color: #333; flex-shrink: 0; position: relative;">Design With Sales</div>
    <div id="designs-with-sales-list" class="designs-scrollable-list" style="flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; padding-right: 8px;">
      <div style="text-align: center; color: #999; padding: 20px;">Loading...</div>
    </div>
  `;let t=e.querySelector("#designs-with-sales-title");if(t){let e=H("blur_switch_designs");t.appendChild(e)}return e}();e.appendChild(t);let o=function(){let e=document.createElement("div");return e.id="summary-statistics-section",e.style.cssText=`
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 15px;
    background-color: white;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    height: 600px;
    box-sizing: border-box;
    align-content: start;
    overflow-y: auto;
  `,e.innerHTML='<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: #999;">Loading...</div>',e}();return e.appendChild(o),setTimeout(()=>{R()},100),setTimeout(()=>{N()},100),e}();e.appendChild(i)}async function s(e){for(;e.firstChild;)e.removeChild(e.firstChild);e.innerHTML="";try{let t=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),o=t&&t.success?t.works:[],r=o.filter(e=>e&&e.workId&&!1!==e.isActive),l=new Map;r.forEach(e=>{l.has(e.workId)||l.set(e.workId,e)});let a=Array.from(l.values()),n=[...a],s="sales",d="desc",c=1,p=(e,t,o)=>{let r=[...o];return r.sort((o,r)=>{let i,l;switch(e){case"title":i=(o.title||"").toLowerCase(),l=(r.title||"").toLowerCase();break;case"sales":i=o.stats?.sales||0,l=r.stats?.sales||0;break;case"favorites":i=o.stats?.favorites||0,l=r.stats?.favorites||0;break;case"comments":i=o.stats?.comments||0,l=r.stats?.comments||0;break;default:return 0}return"string"==typeof i?"asc"===t?i.localeCompare(l):l.localeCompare(i):"asc"===t?i-l:l-i}),r};n=p(s,d,n);let g=e=>{let t=(c-1)*200;return e.slice(t,t+200)},h=async e=>{let t=b.querySelector("#designs-table-body");if(!t)return;let o=await I(),r=g(e);t.innerHTML=r.map((e,t)=>{let r=e.stats?.sales||0,l=e.stats?.favorites||0,a=e.stats?.comments||0;return`
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 12px;">
              <input type="checkbox" class="row-checkbox" data-work-id="${e.workId}">
            </td>
            <td style="padding: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="hide-in-screenshot image-preview-container" data-image-url="${(0,i.getBunnyThumbnailUrl)(e.imageUrl||e.thumbnailUrl||"")}" style="width: 50px; height: 50px; flex-shrink: 0; position: relative; cursor: pointer;">
                  <img src="${(0,i.getBunnyThumbnailUrl)(e.imageUrl||e.thumbnailUrl||"")}" alt="${e.title}" 
                       style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;"
                       onerror="this.style.display='none'">
                </div>
                <div>
                  <a href="${e.url||e.editUrl}" target="_blank" 
                     class="hide-in-screenshot"
                     style="color: #10b981; text-decoration: none; font-weight: 500; display: block; margin-bottom: 4px;">
                    ${e.title||"Untitled"}
                  </a>
                  <div style="font-size: 11px; color: #999;">
                    ${e.description?e.description.substring(0,60)+"...":""}
                  </div>
                </div>
              </div>
            </td>
            <td style="padding: 12px; color: #555; text-align: center;">${r}</td>
            <td style="padding: 12px; color: #555; text-align: center;">${l}</td>
            <td style="padding: 12px; color: #555; text-align: center;">${a}</td>
            <td style="padding: 12px;">
              <div style="display: flex; gap: 8px; align-items: center;">
                <a href="${e.editUrl||e.url}" target="_blank" rel="noopener noreferrer" 
                   style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background-color: transparent; border: none; text-decoration: none; cursor: pointer; color: #f59e0b; opacity: 0.6; transition: opacity 0.2s;" 
                   onmouseover="this.style.opacity='1'" 
                   onmouseout="this.style.opacity='0.6'"
                   title="Edit design">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354L11.427 2.487zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.25.25 0 00.108-.064l6.286-6.286z"/>
                  </svg>
                </a>
                <button class="copy-link-btn" data-work-id="${e.workId}" style="background: none; border: none; cursor: pointer; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Copy Link">
                  <img src="${o}" alt="Copy Link" style="width: 16px; height: 16px; object-fit: contain;">
                </button>
              </div>
            </td>
          </tr>
        `}).join("");let l=window.__applyScreenshotMode,a=window.__getSavedScreenshotMode;if(l&&a){let e=a();e&&l(e)}},m=e=>{s===e?d="asc"===d?"desc":"asc":(s=e,d="asc"),n=p(s,d,n),c=1,h(n).then(()=>{let e=b.querySelector("#designs-table-body");e&&Z(b)}).catch(()=>{}),f(),u(),k()},u=()=>{let e=b.querySelector(".pagination-info"),t=b.querySelector(".pagination-controls");if(!e||!t)return;let o=Math.ceil(n.length/200),r=(c-1)*200+1,i=Math.min(200*c,n.length);e.innerHTML=`
        Showing ${r} to ${i} of ${n.length} Designs
        <span style="margin-left: 8px;">Page ${c} of ${o}</span>
      `;let l=t.querySelector(".pagination-prev"),a=t.querySelector(".pagination-next");l&&(l.disabled=1===c,1===c?(l.style.opacity="0.5",l.style.cursor="not-allowed"):(l.style.opacity="1",l.style.cursor="pointer")),a&&(a.disabled=c>=o,c>=o?(a.style.opacity="0.5",a.style.cursor="not-allowed"):(a.style.opacity="1",a.style.cursor="pointer"))},f=()=>{let e=b.querySelectorAll(".sortable-header");e.forEach(e=>{let t=e.getAttribute("data-column"),o=e.querySelector(".sort-icon");o&&(t===s?(o.textContent="asc"===d?"\u25b2":"\u25bc",o.style.color="#333",o.style.fontSize="11px",o.style.lineHeight="1"):(o.innerHTML='\u25b2<br style="line-height: 0.3; font-size: 4px;">\u25bc',o.style.color="#ccc",o.style.fontSize="9px",o.style.lineHeight="0.7"))})},b=document.createElement("div");b.style.cssText=`
      background: white;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 20px;
      overflow-x: auto;
    `;let x=H("blur_switch_design_page",!0),y=x.outerHTML;b.innerHTML=`
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div style="font-weight: 600; font-size: 16px; color: #333;">
          ${a.length} Designs
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          ${y}
          <button id="design-edit-btn" style="padding: 6px 12px; border: 1px solid #dee2e6; border-radius: 4px; background: white; color: #495057; cursor: pointer; font-size: 13px;">
            Edit
          </button>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 2px solid #dee2e6;">
            <th style="padding: 10px; text-align: left; font-weight: 600; color: #333;">
              <input type="checkbox" id="select-all-checkbox">
            </th>
            <th class="sortable-header" data-column="title" style="padding: 10px; text-align: left; font-weight: 600; color: #333; cursor: pointer; user-select: none;">
              <span style="display: flex; align-items: center; justify-content: space-between;">
                <span>Title</span>
                <span class="sort-icon" style="color: #ccc; font-size: 9px; margin-left: 8px; display: inline-block; vertical-align: middle; line-height: 0.7;">\u25b2<br style="line-height: 0.3; font-size: 4px;">\u25bc</span>
              </span>
            </th>
            <th class="sortable-header" data-column="sales" style="padding: 10px; text-align: left; font-weight: 600; color: #333; cursor: pointer; user-select: none;">
              <span style="display: flex; align-items: center; justify-content: space-between;">
                <span>Sales</span>
                <span class="sort-icon" style="color: #333; font-size: 11px; margin-left: 8px; display: inline-block; vertical-align: middle; line-height: 1;">\u25bc</span>
              </span>
            </th>
            <th class="sortable-header" data-column="favorites" style="padding: 10px; text-align: left; font-weight: 600; color: #333; cursor: pointer; user-select: none;">
              <span style="display: flex; align-items: center; justify-content: space-between;">
                <span>Favorites</span>
                <span class="sort-icon" style="color: #ccc; font-size: 9px; margin-left: 8px; display: inline-block; vertical-align: middle; line-height: 0.7;">\u25b2<br style="line-height: 0.3; font-size: 4px;">\u25bc</span>
              </span>
            </th>
            <th class="sortable-header" data-column="comments" style="padding: 10px; text-align: left; font-weight: 600; color: #333; cursor: pointer; user-select: none;">
              <span style="display: flex; align-items: center; justify-content: space-between;">
                <span>Comments</span>
                <span class="sort-icon" style="color: #ccc; font-size: 9px; margin-left: 8px; display: inline-block; vertical-align: middle; line-height: 0.7;">\u25b2<br style="line-height: 0.3; font-size: 4px;">\u25bc</span>
              </span>
            </th>
            <th style="padding: 10px; text-align: left; font-weight: 600; color: #333;">Actions</th>
          </tr>
        </thead>
        <tbody id="designs-table-body">
        </tbody>
      </table>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
        <div class="pagination-info" style="font-size: 13px; color: #666;">
          Showing 1 to ${Math.min(200,n.length)} of ${n.length} Designs
          <span style="margin-left: 8px;">Page 1 of ${Math.ceil(n.length/200)}</span>
        </div>
        <div class="pagination-controls" style="display: flex; gap: 8px; align-items: center;">
          <button class="pagination-prev" style="padding: 6px 12px; border: 1px solid #dee2e6; border-radius: 4px; background: white; color: #495057; cursor: pointer; font-size: 13px;">
            Previous
          </button>
          <button class="pagination-next" style="padding: 6px 12px; border: 1px solid #dee2e6; border-radius: 4px; background: white; color: #495057; cursor: pointer; font-size: 13px;">
            Next
          </button>
        </div>
      </div>
    `,e.appendChild(b);let v=b.__designEditClickHandler;v&&b.removeEventListener("click",v);let w=e=>{let t=e.target,o=t.closest("#design-edit-btn");if(o){e.preventDefault(),e.stopPropagation();let t=b.querySelectorAll(".row-checkbox"),o=Array.from(t).filter(e=>e.checked).map(e=>{let t=e.getAttribute("data-work-id");return n.find(e=>e.workId===t)}).filter(e=>void 0!==e);o.length>0&&o.forEach(e=>{let t=e.editUrl||e.url;t&&window.open(t,"_blank")})}};b.addEventListener("click",w),b.__designEditClickHandler=w;let k=()=>{let e=b.querySelectorAll(".row-checkbox"),t=b.querySelector("#select-all-checkbox");if(!t)return;let o=Array.from(e).filter(e=>e.checked).length,r=e.length;0===o?(t.checked=!1,t.indeterminate=!1):o===r?(t.checked=!0,t.indeterminate=!1):(t.checked=!1,t.indeterminate=!0)},$=e=>{let t=Math.ceil(n.length/200);e>=1&&e<=t&&(c=e,h(n).then(()=>{let e=b.querySelector("#designs-table-body");e&&Z(b)}).catch(()=>{}),u(),k())};h(n).then(()=>{Z(b)}).catch(()=>{}),f(),u(),k();let S=b.querySelector("#select-all-checkbox");S&&S.addEventListener("change",e=>{let t=e.target.checked,o=b.querySelectorAll(".row-checkbox");o.forEach(e=>{e.checked=t})}),b.addEventListener("change",e=>{let t=e.target;t.classList.contains("row-checkbox")&&k()});let E=b.__tableClickHandler;E&&b.removeEventListener("click",E);let C=async e=>{let t=e.target,o=t.closest(".copy-link-btn");if(o){e.preventDefault(),e.stopPropagation();let t=o.getAttribute("data-work-id");if(!t)return;let r=n.find(e=>e.workId===t);if(!r)return;let i=r.duplicateUrl;if(!i&&r.editUrl&&(i=r.editUrl.replace("/edit","/duplicate")),!i&&r.url&&(i=r.url.includes("/portfolio/images/")?r.url+"/duplicate":r.editUrl?r.editUrl.replace("/edit","/duplicate"):""),i)try{await navigator.clipboard.writeText(i);let e=o.querySelector("img");e&&(e.src,e.style.opacity="0.5",setTimeout(()=>{e.style.opacity="1"},500))}catch(t){let e=document.createElement("textarea");e.value=i,e.style.position="fixed",e.style.left="-999999px",document.body.appendChild(e),e.select();try{document.execCommand("copy"),e.remove()}catch(t){alert("Cannot copy to clipboard. URL: "+i),e.remove()}}else alert("Cannot find duplicate URL for this design");return}let r=t.closest(".pagination-prev");if(r){e.preventDefault(),e.stopPropagation(),c>1&&$(c-1);return}let i=t.closest(".pagination-next");if(i){e.preventDefault(),e.stopPropagation();let t=Math.ceil(n.length/200);c<t&&$(c+1);return}let l=t.closest(".sortable-header");if(l){e.preventDefault(),e.stopPropagation();let t=l.getAttribute("data-column");t&&m(t);return}};b.addEventListener("click",C),b.__tableClickHandler=C}catch(t){e.innerHTML=`
      <div style="padding: 40px; text-align: center; color: #666;">
        <h2 style="font-size: 24px; margin-bottom: 10px;">\u2630 Design</h2>
        <p style="font-size: 16px; color: #dc3545;">Error loading data</p>
      </div>
    `}}async function d(){let e=document.createElement("div");e.className="merchghost-status-bar",e.style.cssText=`
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: stretch;
    padding: 0;
    background: transparent;
    border: none;
    margin-bottom: 16px;
  `;let t=document.createElement("div");t.style.cssText=`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
    padding: 8px 12px;
    background-color: #ffffff;
    border: 2px solid #10b981;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  `;let o=document.createElement("div");o.id="live-designs-status-section",o.className="dash-top-stats published-designs",o.style.cssText="text-align: left;",m().then(e=>{let t=Math.round(e/30*1e3)/10;o.innerHTML=`
      <div class="title" style="color: #959595; font-size: 11px; line-height: 1; text-transform: uppercase; margin-bottom: 4px; font-weight: 500;">Uploaded Today</div>
      <div class="progress-text" style="margin: 0 0 4px 0; text-align: left; line-height: 1.2;">
        <span class="used" style="font-weight: 700; font-size: 18px; color: #333;">${e}</span>
        <span style="font-size: 14px; color: #666;"> of </span>
        <span class="limit" style="font-weight: 700; font-size: 18px; color: #333;">30</span>
        <span class="progress-percent" style="margin-left: 6px; font-size: 12px; color: #959595;">(${t.toFixed(1)}%)</span>
      </div>
      <div class="progress" style="height: 6px; border-radius: 3px; background-color: #e0e0e0; overflow: hidden;">
        <div class="progress-bar" style="width: ${Math.min(t,100)}%; height: 6px; background-color: #10b981; border-radius: 3px; transition: width 0.3s ease;"></div>
      </div>
    `}).catch(()=>{o.innerHTML=`
      <div class="title" style="color: #959595; font-size: 11px; line-height: 1; text-transform: uppercase; margin-bottom: 4px; font-weight: 500;">Uploaded Today</div>
      <div class="progress-text" style="margin: 0 0 4px 0; text-align: left; line-height: 1.2;">
        <span class="used" style="font-weight: 700; font-size: 18px; color: #333;">0</span>
        <span style="font-size: 14px; color: #666;"> of </span>
        <span class="limit" style="font-weight: 700; font-size: 18px; color: #333;">30</span>
        <span class="progress-percent" style="margin-left: 6px; font-size: 12px; color: #959595;">(0.0%)</span>
      </div>
      <div class="progress" style="height: 6px; border-radius: 3px; background-color: #e0e0e0; overflow: hidden;">
        <div class="progress-bar" style="width: 0%; height: 6px; background-color: #10b981; border-radius: 3px;"></div>
      </div>
    `}),t.appendChild(o);let r=document.createElement("div");r.id="designs-with-sales-status-section",r.className="dash-top-stats designs-with-sales",r.style.cssText="text-align: left;",h().then(({withSales:e,totalLive:t})=>{let o=t>0?Math.round(e/t*100):0;r.innerHTML=`
      <div class="title" style="color: #959595; font-size: 11px; line-height: 1; text-transform: uppercase; margin-bottom: 4px; font-weight: 500;">Designs with Sales</div>
      <div class="progress-text" style="margin: 0 0 4px 0; text-align: left; line-height: 1.2;">
        <span class="used" style="font-weight: 700; font-size: 18px; color: #333;">${e}</span>
        <span style="font-size: 14px; color: #666;"> of </span>
        <span class="limit" style="font-weight: 700; font-size: 18px; color: #333;">${t}</span>
        <span style="font-size: 14px; color: #666;"> live </span>
        <span class="progress-percent" style="margin-left: 6px; font-size: 12px; color: #959595;">(${o}%)</span>
      </div>
      <div class="progress" style="height: 6px; border-radius: 3px; background-color: #e0e0e0; overflow: hidden;">
        <div class="progress-bar" style="width: ${Math.min(o,100)}%; height: 6px; background-color: #10b981; border-radius: 3px; transition: width 0.3s ease;"></div>
      </div>
    `}).catch(()=>{r.innerHTML=`
      <div class="title" style="color: #959595; font-size: 11px; line-height: 1; text-transform: uppercase; margin-bottom: 4px; font-weight: 500;">Designs with Sales</div>
      <div class="progress-text" style="margin: 0 0 4px 0; text-align: left; line-height: 1.2;">
        <span class="used" style="font-weight: 700; font-size: 18px; color: #333;">0</span>
        <span style="font-size: 14px; color: #666;"> of </span>
        <span class="limit" style="font-weight: 700; font-size: 18px; color: #333;">0</span>
        <span style="font-size: 14px; color: #666;"> live </span>
        <span class="progress-percent" style="margin-left: 6px; font-size: 12px; color: #959595;">(0%)</span>
      </div>
      <div class="progress" style="height: 6px; border-radius: 3px; background-color: #e0e0e0; overflow: hidden;">
        <div class="progress-bar" style="width: 0%; height: 6px; background-color: #10b981; border-radius: 3px;"></div>
      </div>
    `}),t.appendChild(r);let i=document.createElement("div");i.style.cssText=`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background-color: #ffffff;
    border: 2px solid #10b981;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    white-space: nowrap;
  `;let l="Unknown",a=0,n=0;try{let e=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllTiers"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(e&&e.success&&e.tiers&&e.tiers.length>0){let t=e.tiers.sort((e,t)=>e.id&&t.id?t.id-e.id:new Date(t.timestamp||t.date||0).getTime()-new Date(e.timestamp||e.date||0).getTime())[0];l=t.tier||"Unknown"}let t=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getMetadata",key:"artistFollowers"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),o=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getMetadata",key:"artistFavorites"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});t&&t.success&&t.value&&(a=parseInt(t.value)||0),o&&o.success&&o.value&&(n=parseInt(o.value)||0)}catch(e){}let s=document.createElement("div");s.style.cssText="font-weight: 600; font-size: 14px; color: #333; line-height: 1; margin: 0;",s.textContent=`TIER: ${l}`,i.appendChild(s);let d=document.createElement("div");d.style.cssText="display: flex; align-items: center; gap: 4px; margin: 0;",d.innerHTML=`
    <svg width="14" height="14" viewBox="0 0 57 64" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
      <g transform="translate(-4)">
        <path d="m4 64c0.11974-15.63 12.783-28.293 28.412-28.412 15.63-0.11974 28.1 12.351 27.98 27.98l-56.393 0.43201zm12.924-49.292c0-8.1228 6.5874-14.708 14.708-14.708h0.34881c8.1232 0 14.708 6.583 14.708 14.708 0 8.1228-6.5874 14.708-14.708 14.708h-0.34881c-8.1232 0-14.708-6.583-14.708-14.708z" fill="#666"/>
      </g>
    </svg>
    <span style="font-weight: 600; font-size: 14px; color: #333;">${a}</span>
  `,i.appendChild(d);let c=document.createElement("div");return c.style.cssText="display: flex; align-items: center; gap: 4px; margin: 0;",c.innerHTML=`
    <svg width="14" height="14" viewBox="0 0 64 52" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
      <g transform="translate(0 -6)">
        <path d="m48 6c-4.4187 0-8.4187 1.7704-11.312 4.6315l-4.688 4.5999-4.688-4.5999c-2.8933-2.8611-6.8933-4.6315-11.312-4.6315-8.8347 0-16 7.079-16 15.807 0 4.3654 1.5707 7.1712 5.7493 11.3l23.421 23.145c0.78133 0.77192 1.8053 1.1566 2.8293 1.1566s2.048-0.38464 2.8293-1.1566l23.357-23.081c4.1333-4.0835 5.8133-6.9974 5.8133-11.363 0-8.7283-7.1653-15.807-16-15.807" fill="#e91e63"/>
      </g>
    </svg>
    <span style="font-weight: 600; font-size: 14px; color: #333;">${n}</span>
  `,i.appendChild(c),e.appendChild(t),e.appendChild(i),e}async function c(){try{let e=document.querySelector(".merchghost-status-bar");if(!e)return;let t=e.querySelector('div[style*="flex-direction: row"]');if(!t)return;let o="Unknown",r=0,i=0;try{let e=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllTiers"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(e&&e.success&&e.tiers&&e.tiers.length>0){let t=e.tiers.sort((e,t)=>e.id&&t.id?t.id-e.id:new Date(t.timestamp||t.date||0).getTime()-new Date(e.timestamp||e.date||0).getTime())[0];o=t.tier||"Unknown"}let t=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getMetadata",key:"artistFollowers"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),l=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getMetadata",key:"artistFavorites"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});t&&t.success&&t.value&&(r=parseInt(t.value)||0),l&&l.success&&l.value&&(i=parseInt(l.value)||0)}catch(e){return}let l=t.querySelector("div:first-child");l&&(l.textContent=`TIER: ${o}`);let a=t.querySelector("div:nth-child(2)");if(a){let e=a.querySelector("span");e&&(e.textContent=r.toString())}let n=t.querySelector("div:nth-child(3)");if(n){let e=n.querySelector("span");e&&(e.textContent=i.toString())}}catch(e){}}function p(){let e=new Date,t=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"});return t.format(e)}function g(e){let t=p(),o=null;return(e.forEach(e=>{e.orderDate&&(!o||e.orderDate>o)&&(o=e.orderDate)}),o&&o>t)?o:t}async function h(){try{let[e,t]=await Promise.all([new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllSales"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})})]);if(!t||!t.success||!t.works)return{withSales:0,totalLive:0};let o=t.works,r=o.filter(e=>!0===e.isActive),i=r.length;if(!e||!e.success||!e.sales)return{withSales:0,totalLive:i};let l=e.sales,a=new Set;l.forEach(e=>{e.workId&&a.add(e.workId)});let n=r.filter(e=>a.has(e.workId)).length;return{withSales:n,totalLive:i}}catch(e){return{withSales:0,totalLive:0}}}async function m(){try{let e=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(!e||!e.success||!e.works)return 0;let t=e.works,o=p(),r=t.filter(e=>{if(!e.publishedDate)return!1;if(e.publishedDate.includes("T")){let t=new Date(e.publishedDate),r=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(t);return r===o}return e.publishedDate===o});return r.length}catch(e){return 0}}async function u(){let e=document.getElementById("sales-chart-canvas");if(!e)return;let t=e.getContext("2d");if(!t)return;let o=e.parentElement;if(!o)return;let r=window.devicePixelRatio||1,i=o.getBoundingClientRect();e.width=i.width*r,e.height=240*r,t.scale(r,r);let l=i.width;try{let o=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllSales"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(!o||!o.success||!o.sales){f(t,l,240);return}let r=o.sales,i=g(r),[a,n,s]=i.split("-").map(Number),d=new Date(a,n-1,s),c=[],p={};for(let e=6;e>=0;e--){let t=new Date(d);t.setDate(t.getDate()-e);let o=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`,r=t.toLocaleDateString("en-US",{weekday:"short",month:"2-digit",day:"2-digit"});c.push({date:o,label:r}),p[o]={quantity:0,sold:0,cancelled:0,royalties:0,revenue:0,sales:[]}}r.forEach(e=>{let t=e.orderDate;if(p[t]){let o=e.quantity||1;p[t].quantity+=o,e.isCancelled?p[t].cancelled+=o:(p[t].sold+=o,p[t].royalties+=e.artistMargin||e.netProfit||0),p[t].sales.push(e)}});let h=c.map(async e=>{let t=p[e.date].sales;if(0===t.length)return{quantity:0,sold:0,cancelled:0,royalties:0,fees:0,netProfit:0};let o=await C(t),r=p[e.date].royalties,i=r-o.totalFees;return{quantity:p[e.date].quantity,sold:p[e.date].sold,cancelled:p[e.date].cancelled,royalties:r,fees:o.totalFees,netProfit:i}}),m=await Promise.all(h),u=m.map(e=>e.quantity),x=m.map(e=>e.royalties);b(t,l,240,c,u,x),function(e,t,o){let r=document.getElementById("chart-tooltip");if(!r)return;let i={top:30,right:50,bottom:35,left:45},l=e.getBoundingClientRect(),a=l.width,n=a-i.left-i.right,s=240-i.top-i.bottom,d=n/t.length,c=.35*d,p=d-c,g=Math.max(...o.map(e=>e.quantity),4);e.addEventListener("mousemove",l=>{let n=e.getBoundingClientRect(),h=l.clientX-n.left,m=l.clientY-n.top;if(h<i.left||h>a-i.right||m<i.top||m>240-i.bottom){r.style.display="none",e.style.cursor="default";return}let u=Math.floor((h-i.left)/d);if(u<0||u>=t.length){r.style.display="none",e.style.cursor="default";return}let f=o[u];if(0===f.quantity){r.style.display="none",e.style.cursor="default";return}let b=i.left+u*d+c/2,x=f.quantity/g*s,y=i.top+s-x;if(h>=b&&h<=b+p&&m>=y&&m<=i.top+s){e.style.cursor="pointer";let o=t[u];r.innerHTML=`
        <div style="font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
          <div style="font-weight: 700; margin-bottom: 8px; color: #333; font-size: 13px;">
            ${o.label}
          </div>
          <div style="margin-bottom: 5px; color: #555; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <span style="color: #10b981; font-size: 16px;">\u25a0</span>
            <span>Sold: <strong style="font-weight: 600;">${f.sold}</strong></span>
          </div>
          <div style="margin-bottom: 5px; color: #555; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <span style="color: #d97706; font-size: 16px;">\u25a0</span>
            <span>Cancelled: <strong style="font-weight: 600;">${f.cancelled}</strong></span>
          </div>
          <div style="margin-bottom: 5px; color: #555; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <span style="color: #059669; font-size: 16px;">\u25a0</span>
            <span>Royalties: <strong style="font-weight: 600;">$${f.royalties.toFixed(2)}</strong></span>
          </div>
          <div style="margin-bottom: 5px; color: #555; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <span style="color: #dc2626; font-size: 16px;">\u25a0</span>
            <span>Fees: <strong style="font-weight: 600;">$${f.fees.toFixed(2)}</strong></span>
          </div>
          <div style="margin-bottom: 8px; color: #555; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <span style="color: #ec4899; font-size: 16px;">\u25a0</span>
            <span>Net Profit: <strong style="font-weight: 600;">$${f.netProfit.toFixed(2)}</strong></span>
          </div>
          <div style="font-size: 11px; color: #999; font-style: italic; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e8e8e8; text-align: center;">
            Click to view details
          </div>
        </div>
      `;let i=l.clientX-n.left+15,s=l.clientY-n.top-90;i+160>a&&(i=l.clientX-n.left-160-15),s<0&&(s=10),s+180>240&&(s=50),r.style.display="block",r.style.left=i+"px",r.style.top=s+"px"}else r.style.display="none",e.style.cursor="default"}),e.addEventListener("mouseleave",()=>{r.style.display="none",e.style.cursor="default"});let h=e.__chartClickHandler;h&&e.removeEventListener("click",h);let m=r=>{let l=e.getBoundingClientRect(),n=r.clientX-l.left,h=r.clientY-l.top;if(n<i.left||n>a-i.right||h<i.top||h>240-i.bottom)return;let m=Math.floor((n-i.left)/d);if(m<0||m>=t.length)return;let u=o[m];if(0===u.quantity)return;let f=i.left+m*d+c/2,b=u.quantity/g*s,x=i.top+s-b;if(n>=f&&n<=f+p&&h>=x&&h<=i.top+s){let e=t[m];v(e.date)}};e.addEventListener("click",m),e.__chartClickHandler=m}(e,c,m)}catch(e){f(t,l,240)}}function f(e,t,o){e.clearRect(0,0,t,o),e.fillStyle="#999",e.font="13px Arial",e.textAlign="center",e.fillText("No sales data available",t/2,o/2)}function b(e,t,o,r,i,l){let a={top:20,right:40,bottom:30,left:40},n=t-a.left-a.right,s=o-a.top-a.bottom;e.clearRect(0,0,t,o);let d=Math.max(...i,4),c=Math.max(...l,10);e.strokeStyle="rgba(0, 0, 0, 0.05)",e.lineWidth=1;for(let o=0;o<=4;o++){let r=a.top+s/4*o;e.beginPath(),e.moveTo(a.left,r),e.lineTo(t-a.right,r),e.stroke()}let p=n/r.length,g=.6*p,h=p-g;i.forEach((t,o)=>{if(0===t)return;let r=a.left+o*p+g/2,i=a.top+s-t/d*s,l=a.top+s,n=e.createLinearGradient(r,i,r,l);n.addColorStop(0,"rgba(16, 185, 129, 0.2)"),n.addColorStop(1,"rgba(16, 185, 129, 0.1)"),e.beginPath(),e.moveTo(r+4,i),e.lineTo(r+h-4,i),e.quadraticCurveTo(r+h,i,r+h,i+4),e.lineTo(r+h,l),e.lineTo(r,l),e.lineTo(r,i+4),e.quadraticCurveTo(r,i,r+4,i),e.closePath(),e.fillStyle=n,e.fill(),e.strokeStyle="rgba(16, 185, 129, 0.4)",e.lineWidth=1,e.stroke(),e.fillStyle="#10b981",e.font="bold 13px Arial",e.textAlign="center",e.textBaseline="bottom",e.fillText(t.toString(),r+h/2,i-5)}),e.strokeStyle="#FF6B9D",e.lineWidth=2.5,e.lineCap="round",e.lineJoin="round";let m=l.map((e,t)=>{let o=a.left+t*p+p/2,r=a.top+s-e/c*s;return{x:o,y:r,value:e}});e.beginPath();for(let t=0;t<m.length;t++){let o=m[t];if(0===t)e.moveTo(o.x,o.y);else{let r=m[t-1],i=r.x+(o.x-r.x)/3,l=r.y,a=r.x+2*(o.x-r.x)/3,n=o.y;e.bezierCurveTo(i,l,a,n,o.x,o.y)}}e.stroke(),m.forEach(t=>{e.fillStyle="#FF6B9D",e.beginPath(),e.arc(t.x,t.y,5,0,2*Math.PI),e.fill(),e.strokeStyle="white",e.lineWidth=2,e.stroke()}),e.fillStyle="#999",e.font="11px Arial",e.textAlign="center",e.textBaseline="top",r.forEach((t,r)=>{let i=a.left+r*p+p/2;e.fillText(t.label,i,o-20)}),e.fillStyle="#999",e.font="11px Arial",e.textAlign="right",e.textBaseline="middle";for(let t=0;t<=4;t++){let o=Math.round(d/4*t),r=a.top+s-s/4*t;e.fillText(o.toString(),a.left-10,r)}e.textAlign="left";for(let o=0;o<=4;o++){let r=c/4*o,i=a.top+s-s/4*o;e.fillText("$"+r.toFixed(0),t-a.right+10,i)}}async function x(){try{let e=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(!e||!e.success||!e.works){alert("No works data available");return}let t=e.works,o=t.filter(e=>(e.totalQuantity||0)>0);if(0===o.length){alert("No works with sales");return}await B(o)}catch(e){}}async function y(e,t){try{let o=g(t),[r,i,l]=o.split("-").map(Number),a=new Date(r,i-1,l),n=[],s="";if("yesterday"===e){let e=new Date(a);e.setDate(e.getDate()-1);let o=`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`;n=t.filter(e=>e.orderDate===o);let r=new Date(o+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"});s=`Yesterday ${r}`}else if("last7Days"===e){let e=new Date(a);e.setDate(e.getDate()-6);let r=`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`;n=t.filter(e=>e.orderDate>=r&&e.orderDate<=o);let i=new Date(r+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"}),l=new Date(o+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"});s=`Last 7 Days ${i}-${l}`}else if("thisMonth"===e){let e=new Date(a.getFullYear(),a.getMonth(),1),r=`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`;n=t.filter(e=>e.orderDate>=r&&e.orderDate<=o);let i=new Date(r+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"}),l=new Date(o+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"});s=`This Month ${i}-${l}`}else if("previousMonth"===e){let e=new Date(a.getFullYear(),a.getMonth()-1,1),o=new Date(a.getFullYear(),a.getMonth(),0),r=`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`,i=`${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,"0")}-${String(o.getDate()).padStart(2,"0")}`;n=t.filter(e=>e.orderDate>=r&&e.orderDate<=i);let l=new Date(r+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});s=`Previous Month ${l}`}else if("allTime"===e){n=t;let e=null,o=null;if(t.forEach(t=>{t.orderDate&&((!e||t.orderDate<e)&&(e=t.orderDate),(!o||t.orderDate>o)&&(o=t.orderDate))}),e&&o){let t=e=>{let[t,o]=e.split("-"),r=parseInt(o)-1;return`${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][r]} ${t}`},r=t(e),i=t(o);s=r===i?r:`${r} - ${i}`}else s="All Time"}if(0===n.length){alert("No sales for this period");return}let d=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),c=new Map;d&&d.success&&d.works&&d.works.forEach(e=>{c.set(e.workId,e)}),w(s,n,c)}catch(e){}}async function v(e){try{let t=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllSales"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(!t||!t.success||!t.sales)return;let o=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),r=new Map;o&&o.success&&o.works&&o.works.forEach(e=>{r.set(e.workId,e)});let i=t.sales.filter(t=>{let o=t.orderDate===e;return o});if(0===i.length){alert("No sales on this day");return}await F(e,i,r)}catch(e){}}async function w(e,t,o){await F(e,t,o)}async function k(e,t){try{let o="all";"yesterday"===e?o="yesterday":"last7Days"===e?o="last7days":"thisMonth"===e?o="thismonth":"previousMonth"===e?o="previousmonth":"allTime"===e&&(o="all"),await $(o,t)}catch(e){}}async function $(e,t){let o=document.getElementById("chart-modal-overlay");o&&o.remove();let r="Sales Chart";if("yesterday"===e)r="Yesterday";else if("last7days"===e)r="Last 7 Days";else if("thismonth"===e)r="This Month";else if("previousmonth"===e)r="Previous Month";else if("all"===e){let e=null,o=null;if(t.forEach(t=>{t.orderDate&&((!e||t.orderDate<e)&&(e=t.orderDate),(!o||t.orderDate>o)&&(o=t.orderDate))}),e&&o){let t=e=>{let[t,o]=e.split("-"),r=parseInt(o)-1;return`${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][r]} ${t}`},i=t(e),l=t(o);r=i===l?i:`${i} - ${l}`}else r="All Time"}let i=document.createElement("div");i.id="chart-modal-overlay",i.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Lato', sans-serif;
  `;let l=document.createElement("div");l.style.cssText=`
    background: white;
    border: 2px solid #10b981;
    border-radius: 12px;
    max-width: 650px;
    width: 100%;
    max-height: 85vh;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    position: relative;
  `,t.reduce((e,t)=>e+(t.quantity||1),0);let a=t.filter(e=>!e.isCancelled).reduce((e,t)=>e+(t.quantity||1),0),n=t.filter(e=>e.isCancelled).reduce((e,t)=>e+(t.quantity||1),0),s=t.filter(e=>!e.isCancelled).reduce((e,t)=>e+(t.artistMargin||t.netProfit||0),0),d=await C(t),c=d.totalFees;l.innerHTML=`
    <!-- Header -->
    <div style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">Chart: ${r}</h2>
      <button id="close-chart-modal-btn" style="background: #f3f4f6; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="pointer-events: none;">
          <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Statistics Cards -->
    <div style="padding: 8px 16px 6px; display: flex; gap: 0; flex-shrink: 0; flex-wrap: wrap;">
      <!-- Sales Card -->
      <div style="border: 2px solid #93c5fd; border-right: 1px solid #93c5fd; border-radius: 8px 0 0 0; padding: 8px 12px; background: #eff6ff; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 11px; color: #3b82f6; margin-bottom: 4px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Sales</div>
        <div class="auto-resize-number" style="font-size: 28px; font-weight: 700; color: #1e3a8a; line-height: 1;">${a}</div>
      </div>
      
      <!-- Cancelled Card -->
      <div style="border-top: 2px solid #fbbf24; border-bottom: 2px solid #fbbf24; border-left: 1px solid #fbbf24; border-right: 1px solid #fbbf24; padding: 8px 12px; background: #fef3c7; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 11px; color: #d97706; margin-bottom: 4px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Cancelled</div>
        <div class="auto-resize-number" style="font-size: 28px; font-weight: 700; color: #92400e; line-height: 1;">${n}</div>
      </div>
      
      <!-- Royalties Card -->
      <div style="border-top: 2px solid #10b981; border-bottom: 2px solid #10b981; border-left: 1px solid #10b981; border-right: 1px solid #10b981; padding: 8px 12px; background: #d1fae5; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 11px; color: #059669; margin-bottom: 4px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Royalties</div>
        <div class="auto-resize-number" style="font-size: 24px; font-weight: 700; color: #047857; line-height: 1;">$${s.toFixed(2)}</div>
      </div>
      
      <!-- Fees Card -->
      <div style="border-top: 2px solid #ef4444; border-bottom: 2px solid #ef4444; border-left: 1px solid #ef4444; border-right: 1px solid #ef4444; padding: 8px 12px; background: #fee2e2; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 11px; color: #dc2626; margin-bottom: 4px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Fees</div>
        <div class="auto-resize-number" style="font-size: 24px; font-weight: 700; color: #991b1b; line-height: 1;">$${c.toFixed(2)}</div>
      </div>
      
      <!-- Net Profit Card -->
      <div style="border: 2px solid #f9a8d4; border-left: 1px solid #f9a8d4; border-radius: 0 8px 0 0; padding: 8px 12px; background: #fce7f3; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 11px; color: #ec4899; margin-bottom: 4px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Net Profit</div>
        <div class="auto-resize-number" style="font-size: 24px; font-weight: 700; color: #9f1239; line-height: 1;">$${(s-c).toFixed(2)}</div>
      </div>
    </div>

    <!-- Chart Container -->
    <div style="padding: 10px 16px; flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
      <div style="position: relative; height: 280px; flex: 1;">
        <canvas id="chart-modal-canvas" style="cursor: pointer; width: 100%; height: 100%;"></canvas>
        <div id="chart-modal-tooltip" style="display: none; position: absolute; background: white; border: 1px solid #ddd; border-radius: 4px; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); pointer-events: none; z-index: 1000; font-size: 12px; min-width: 140px;"></div>
      </div>
    </div>
  `,i.appendChild(l),document.body.appendChild(i),setTimeout(()=>{_(i)},50),setTimeout(async()=>{await S(e,t)},50);let p=document.getElementById("close-chart-modal-btn");p&&(p.addEventListener("click",()=>{i.remove()}),p.addEventListener("mouseenter",()=>{p.style.background="#e5e7eb"}),p.addEventListener("mouseleave",()=>{p.style.background="#f3f4f6"})),i.addEventListener("click",e=>{e.target===i&&i.remove()})}async function S(e,t){let o=document.getElementById("chart-modal-canvas");if(!o)return;let r=o.getContext("2d");if(!r)return;let i=o.parentElement;if(!i)return;let l=window.devicePixelRatio||1,a=i.getBoundingClientRect();o.width=a.width*l,o.height=280*l,r.scale(l,l);let n=a.width;try{await E(o,r,n,280,t,e)}catch(e){r.fillStyle="#999",r.font="14px Lato",r.textAlign="center",r.fillText("Error loading chart",n/2,140)}}async function E(e,t,o,r,i,l){try{let a=function(){let e=p(),[t,o,r]=e.split("-").map(Number);return new Date(t,o-1,r)}(),n=[],s={};if("last90days"===l||"yeartodate"===l||"previousyear"===l||"all"===l){if("all"===l){if(i.length>0){let e=new Set;i.forEach(t=>{let o=new Date(t.orderDate),r=`${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,"0")}`;e.add(r)});let t=Array.from(e).sort();t.forEach(e=>{let[t,o]=e.split("-"),r=new Date(parseInt(t),parseInt(o)-1,1),i=r.toLocaleDateString("en-US",{month:"short",year:"numeric"});n.push({date:e,label:i}),s[e]={quantity:0,sold:0,cancelled:0,royalties:0,sales:[]}})}}else if("last90days"===l)for(let e=2;e>=0;e--){let t=new Date(a.getFullYear(),a.getMonth()-e,1),o=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}`,r=t.toLocaleDateString("en-US",{month:"short",year:"numeric"});n.push({date:o,label:r}),s[o]={quantity:0,sold:0,cancelled:0,royalties:0,sales:[]}}else if("yeartodate"===l){let e=a.getMonth();for(let t=0;t<=e;t++){let e=new Date(a.getFullYear(),t,1),o=`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}`,r=e.toLocaleDateString("en-US",{month:"short",year:"numeric"});n.push({date:o,label:r}),s[o]={quantity:0,sold:0,cancelled:0,royalties:0,sales:[]}}}else if("previousyear"===l){let e=a.getFullYear()-1;for(let t=0;t<12;t++){let o=new Date(e,t,1),r=`${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,"0")}`,i=o.toLocaleDateString("en-US",{month:"short",year:"numeric"});n.push({date:r,label:i}),s[r]={quantity:0,sold:0,cancelled:0,royalties:0,sales:[]}}}i.forEach(e=>{let t=new Date(e.orderDate),o=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}`;if(s[o]){let t=e.quantity||1;s[o].quantity+=t,e.isCancelled?s[o].cancelled+=t:(s[o].sold+=t,s[o].royalties+=e.artistMargin||e.netProfit||0),s[o].sales.push(e)}})}else{let e=7,t=new Date(a);"last7days"===l?(e=7,(t=new Date(a)).setDate(t.getDate()-6)):"yesterday"===l&&(e=1,(t=new Date(a)).setDate(t.getDate()-1));for(let o=0;o<e;o++){let e=new Date(t);e.setDate(t.getDate()+o);let r=`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`,i=e.toLocaleDateString("en-US",{weekday:"short",month:"2-digit",day:"2-digit"});n.push({date:r,label:i}),s[r]={quantity:0,sold:0,cancelled:0,royalties:0,sales:[]}}i.forEach(e=>{if(s[e.orderDate]){let t=e.quantity||1;s[e.orderDate].quantity+=t,e.isCancelled?s[e.orderDate].cancelled+=t:(s[e.orderDate].sold+=t,s[e.orderDate].royalties+=e.artistMargin||e.netProfit||0),s[e.orderDate].sales.push(e)}})}let d=n.map(async e=>{let t=s[e.date].sales;if(0===t.length)return{quantity:0,sold:0,cancelled:0,royalties:0,fees:0,netProfit:0};let o=await C(t),r=s[e.date].royalties,i=r-o.totalFees;return{quantity:s[e.date].quantity,sold:s[e.date].sold,cancelled:s[e.date].cancelled,royalties:r,fees:o.totalFees,netProfit:i}}),c=await Promise.all(d),g=c.map(e=>e.quantity),h=c.map(e=>e.royalties);b(t,o,r,n,g,h),function(e,t,o){let r=document.getElementById("chart-modal-tooltip");if(!r)return;let i={top:20,right:40,bottom:30,left:40},l=e.width/(window.devicePixelRatio||1),a=l-i.left-i.right,n=a/t.length,s=.6*n,d=n-s,c=280-i.top-i.bottom,p=Math.max(...o.map(e=>e.quantity),4),g=o.map(e=>0===e.quantity?0:e.quantity/p*c);e.addEventListener("mousemove",a=>{let p=e.getBoundingClientRect(),h=a.clientX-p.left,m=a.clientY-p.top;if(h<i.left||h>l-i.right||m<i.top||m>280-i.bottom){r.style.display="none",e.style.cursor="default";return}let u=Math.floor((h-i.left)/n);if(u<0||u>=t.length){r.style.display="none",e.style.cursor="default";return}let f=i.left+u*n+s/2,b=g[u],x=i.top+c-b,y=i.top+c;if(0===b||h<f||h>f+d||m<x||m>y){r.style.display="none",e.style.cursor="default";return}let v=o[u],w=t[u];r.innerHTML=`
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">${w.label}</div>
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
        <div style="width: 10px; height: 10px; background: #10b981; border-radius: 2px;"></div>
        <span style="font-size: 12px;">Sold: <strong>${v.sold}</strong></span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
        <div style="width: 10px; height: 10px; background: #d97706; border-radius: 2px;"></div>
        <span style="font-size: 12px;">Cancelled: <strong>${v.cancelled}</strong></span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
        <div style="width: 10px; height: 10px; background: #059669; border-radius: 2px;"></div>
        <span style="font-size: 12px;">Royalties: <strong>$${v.royalties.toFixed(2)}</strong></span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
        <div style="width: 10px; height: 10px; background: #dc2626; border-radius: 2px;"></div>
        <span style="font-size: 12px;">Fees: <strong>$${v.fees.toFixed(2)}</strong></span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="width: 10px; height: 10px; background: #ec4899; border-radius: 2px;"></div>
        <span style="font-size: 12px;">Net Profit: <strong>$${v.netProfit.toFixed(2)}</strong></span>
      </div>
    `;let k=h+15,$=m-90;k+180>l&&(k=h-180-15),k<0&&(k=10),$<0&&($=10),$+180>280&&($=90),r.style.display="block",r.style.left=`${k}px`,r.style.top=`${$}px`,e.style.cursor="pointer"}),e.addEventListener("mouseleave",()=>{r.style.display="none",e.style.cursor="default"})}(e,n,c)}catch(e){t.fillStyle="#f3f4f6",t.fillRect(0,0,o,r),t.fillStyle="#999",t.font="16px Lato",t.textAlign="center",t.fillText("Error loading chart",o/2,r/2)}}async function C(e){let t="Unknown";try{let e=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllTiers"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(e&&e.success&&e.tiers&&e.tiers.length>0){let o=e.tiers.sort((e,t)=>e.id&&t.id?t.id-e.id:new Date(t.timestamp||t.date||0).getTime()-new Date(e.timestamp||e.date||0).getTime())[0];t=o.tier||"Unknown"}}catch(e){}let o=new Map;try{let e=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllProductPricing"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});e&&e.success&&e.pricing&&e.pricing.forEach(e=>{o.set(e.productName,e.markup||0)})}catch(e){}let r=0;"Standard"===t?r=.5:"Premium"===t?r=.2:"Pro"===t&&(r=0);let i=new Map;e.forEach(e=>{if(e.orderDate){let t=e.orderDate.substring(0,7);i.has(t)||i.set(t,[]),i.get(t).push(e)}});let l=0,a=0,n=0;return i.forEach((e,t)=>{let i=e.filter(e=>!e.isCancelled),s=i.reduce((e,t)=>e+(t.artistMargin||t.netProfit||0),0),d=s*r,c=0;i.forEach(e=>{let t=e.product||e.productType||"",r=o.get(t)||0,i=e.artistMargin||e.netProfit||0;r>20&&(c+=.5*i)});let p=d+c,g=p>150?150:p;if(l+=g,p>0){let e=g/p;a+=d*e,n+=c*e}else a+=d,n+=c}),{totalFees:l,platformFee:a,excessMarkupFee:n}}async function z(){let e=document.getElementById("options-modal-overlay");e&&e.remove();let t=await chrome.storage.local.get(["notificationSound","theme"]),o=t.notificationSound||"cha-ching-sale.mp3",r=t.theme||"light",i=document.createElement("div");i.id="options-modal-overlay",i.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Lato', sans-serif;
  `;let l=document.createElement("div");l.style.cssText=`
    background: white;
    border: 2px solid #10b981;
    border-radius: 12px;
    max-width: 500px;
    width: 100%;
    max-height: 85vh;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    position: relative;
  `,l.innerHTML=`
    <!-- Header -->
    <div style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
      <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">MerchGhost Options</h2>
      <button id="close-options-modal-btn" style="background: #f3f4f6; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; padding: 0;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="pointer-events: none;">
          <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div style="padding: 16px; overflow-y: auto; flex: 1;">
      <!-- Theme Selection -->
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 8px;">
          Theme
        </label>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid ${"light"===r?"#10b981":"#e5e7eb"}; border-radius: 6px; cursor: pointer; background: ${"light"===r?"#ecfdf5":"white"}; transition: all 0.2s;">
            <input type="radio" name="theme" value="light" ${"light"===r?"checked":""} class="theme-radio-input" style="margin: 0; cursor: pointer;">
            <span style="flex: 1; font-size: 14px; color: #111827;">Light Mode</span>
          </label>
          <label style="display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid ${"dark"===r?"#10b981":"#e5e7eb"}; border-radius: 6px; cursor: pointer; background: ${"dark"===r?"#ecfdf5":"white"}; transition: all 0.2s;">
            <input type="radio" name="theme" value="dark" ${"dark"===r?"checked":""} class="theme-radio-input" style="margin: 0; cursor: pointer;">
            <span style="flex: 1; font-size: 14px; color: #111827;">Dark Mode</span>
          </label>
        </div>
      </div>

      <!-- Notification Sound Selection -->
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 8px;">
          Notification Sound
        </label>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${[{file:"cha-ching-sale.mp3",name:"Cha-ching Sale"},{file:"cash-register-purchase-87313.mp3",name:"Cash Register"},{file:"coin-drops-and-spins-272429.mp3",name:"Coin Drops"},{file:"cha-ching.mp3",name:"Cha-ching (Alert)"}].map(e=>`
            <label style="display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid ${o===e.file?"#10b981":"#e5e7eb"}; border-radius: 6px; cursor: pointer; background: ${o===e.file?"#ecfdf5":"white"}; transition: all 0.2s;">
              <input type="radio" name="notificationSound" value="${e.file}" ${o===e.file?"checked":""} class="sound-radio-input" style="margin: 0; cursor: pointer;">
              <span style="flex: 1; font-size: 14px; color: #111827;">${e.name}</span>
              <button class="play-sound-btn" data-sound="${e.file}" style="background: #10b981; color: white; border: none; border-radius: 4px; padding: 4px 12px; font-size: 12px; cursor: pointer; transition: opacity 0.2s;">
                Play
              </button>
            </label>
          `).join("")}
        </div>
      </div>
    </div>
  `,i.appendChild(l),document.body.appendChild(i),setTimeout(()=>{_(i)},50);let a=i.querySelector("#close-options-modal-btn");a?.addEventListener("click",()=>{i.remove()}),i.addEventListener("click",e=>{e.target===i&&i.remove()});let n=i.querySelectorAll(".play-sound-btn");n.forEach(e=>{e.addEventListener("click",async t=>{t.stopPropagation();let o=e.getAttribute("data-sound");if(o)try{let e=chrome.runtime.getURL(`assets/sounds/${o}`),t=new Audio(e);t.volume=.7,await t.play()}catch(e){}})});let s=i.querySelectorAll('input[name="notificationSound"]');s.forEach(e=>{e.addEventListener("change",async e=>{let t=e.target;if(t.checked){let e=t.value;await chrome.storage.local.set({notificationSound:e})}})});let d=i.querySelectorAll('input[name="theme"]');d.forEach(e=>{e.addEventListener("change",async e=>{let t=e.target;if(t.checked){let e="dark"===t.value?"dark":"light";await chrome.storage.local.set({theme:e}),L(e),await j(),await q(),await P(),await A()}})})}function L(e){let t=document.getElementById("merchghost-dashboard-wrapper");if(t){if("dark"===e){t.classList.add("dark-mode"),t.classList.remove("light-mode"),t.style.background="#0a0a0a",t.style.color="#e5e5e5",j(),q(),P(),A();let e=document.querySelector("header")||document.querySelector('[role="banner"]');if(e){e.classList.add("dark-mode"),e.style.backgroundColor="#0a0a0a",e.style.color="#e5e5e5";let t=e.querySelectorAll("*");t.forEach(e=>{let t=e.style,o=window.getComputedStyle(e);("rgb(255, 255, 255)"===o.backgroundColor||"white"===t.backgroundColor||"#fff"===t.backgroundColor||"#ffffff"===t.backgroundColor)&&(t.backgroundColor="#0a0a0a"),("rgb(249, 250, 251)"===o.backgroundColor||"rgb(250, 250, 250)"===o.backgroundColor||"rgb(243, 244, 246)"===o.backgroundColor)&&(t.backgroundColor="#1a1a1a"),("rgb(51, 51, 51)"===o.color||"rgb(49, 49, 49)"===o.color||"#333"===t.color||"#313131"===t.color)&&(t.color="#e5e5e5"),("rgb(102, 102, 102)"===o.color||"rgb(153, 153, 153)"===o.color||"#666"===t.color||"#999"===t.color)&&(t.color="#b0b0b0")})}let o=document.querySelector("footer")||document.querySelector('[class*="footer"]')||document.querySelector('[class*="Footer"]');if(o){o.classList.add("dark-mode"),o.style.backgroundColor="#0a0a0a",o.style.color="#e5e5e5";let e=o.querySelectorAll("*");e.forEach(e=>{let t=e.style,o=window.getComputedStyle(e);("rgb(255, 255, 255)"===o.backgroundColor||"white"===t.backgroundColor||"#fff"===t.backgroundColor||"#ffffff"===t.backgroundColor)&&(t.backgroundColor="#0a0a0a"),("rgb(249, 250, 251)"===o.backgroundColor||"rgb(250, 250, 250)"===o.backgroundColor||"rgb(243, 244, 246)"===o.backgroundColor)&&(t.backgroundColor="#1a1a1a"),("rgb(51, 51, 51)"===o.color||"rgb(49, 49, 49)"===o.color||"#333"===t.color||"#313131"===t.color)&&(t.color="#e5e5e5"),("rgb(102, 102, 102)"===o.color||"rgb(153, 153, 153)"===o.color||"#666"===t.color||"#999"===t.color)&&(t.color="#b0b0b0")})}let r=t.querySelectorAll("*");r.forEach(e=>{let t=e.style,o=window.getComputedStyle(e);("white"===t.backgroundColor||"rgb(255, 255, 255)"===t.backgroundColor||"#fff"===t.backgroundColor||"#ffffff"===t.backgroundColor||"rgb(255, 255, 255)"===o.backgroundColor)&&(t.backgroundColor="#0a0a0a"),("#f9fafb"===t.backgroundColor||"#fafafa"===t.backgroundColor||"#f3f4f6"===t.backgroundColor||"#eff6ff"===t.backgroundColor||"#fef3c7"===t.backgroundColor||"#d1fae5"===t.backgroundColor||"#fee2e2"===t.backgroundColor||"#fce7f3"===t.backgroundColor)&&(t.backgroundColor="#1a1a1a"),("#333"===t.color||"#313131"===t.color||"rgb(51, 51, 51)"===t.color||"rgb(49, 49, 49)"===t.color)&&(t.color="#e5e5e5"),("#666"===t.color||"#999"===t.color||"#959595"===t.color||"#888"===t.color||"#9ca3af"===t.color||"#656565"===t.color)&&(t.color="#b0b0b0"),("#e5e7eb"===t.borderColor||"#e0e0e0"===t.borderColor||"#efefef"===t.borderColor||"#d1d5db"===t.borderColor)&&(t.borderColor="#2a2a2a")});let i=document.getElementById("dark-mode-style");i||((i=document.createElement("style")).id="dark-mode-style",document.head.appendChild(i)),i.textContent=`
      #merchghost-dashboard-wrapper.dark-mode {
        background: #0a0a0a !important;
        color: #e5e5e5 !important;
      }
      header.dark-mode,
      header[class*="header"].dark-mode {
        background-color: #0a0a0a !important;
        color: #e5e5e5 !important;
      }
      header.dark-mode *,
      header[class*="header"].dark-mode * {
        background-color: transparent !important;
        color: #e5e5e5 !important;
      }
      header.dark-mode [style*="background-color: white"],
      header.dark-mode [style*="background: white"],
      header[class*="header"].dark-mode [style*="background-color: white"],
      header[class*="header"].dark-mode [style*="background: white"] {
        background-color: #0a0a0a !important;
      }
      header.dark-mode button,
      header[class*="header"].dark-mode button {
        background-color: #1a1a1a !important;
        color: #e5e5e5 !important;
      }
      header.dark-mode a,
      header[class*="header"].dark-mode a {
        color: #e5e5e5 !important;
      }
      header.dark-mode input,
      header[class*="header"].dark-mode input {
        background-color: #1a1a1a !important;
        color: #e5e5e5 !important;
        border-color: #2a2a2a !important;
      }
      footer.dark-mode,
      footer[class*="footer"].dark-mode,
      [class*="footer"].dark-mode {
        background-color: #0a0a0a !important;
        color: #e5e5e5 !important;
      }
      footer.dark-mode *,
      footer[class*="footer"].dark-mode *,
      [class*="footer"].dark-mode * {
        background-color: transparent !important;
        color: #e5e5e5 !important;
      }
      footer.dark-mode [style*="background-color: white"],
      footer.dark-mode [style*="background: white"],
      footer[class*="footer"].dark-mode [style*="background-color: white"],
      footer[class*="footer"].dark-mode [style*="background: white"],
      [class*="footer"].dark-mode [style*="background-color: white"],
      [class*="footer"].dark-mode [style*="background: white"] {
        background-color: #0a0a0a !important;
      }
      footer.dark-mode button,
      footer[class*="footer"].dark-mode button,
      [class*="footer"].dark-mode button {
        background-color: #1a1a1a !important;
        color: #e5e5e5 !important;
      }
      footer.dark-mode a,
      footer[class*="footer"].dark-mode a,
      [class*="footer"].dark-mode a {
        color: #e5e5e5 !important;
      }
      #merchghost-dashboard-wrapper.dark-mode #merchghost-dashboard-container,
      #merchghost-dashboard-wrapper.dark-mode #merchghost-dashboard-content {
        background-color: #0a0a0a !important;
      }
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: white"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: white"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #fff"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #fff"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #ffffff"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #ffffff"],
      #merchghost-dashboard-wrapper.dark-mode div[style*="background-color: white"],
      #merchghost-dashboard-wrapper.dark-mode div[style*="background: white"],
      #merchghost-dashboard-wrapper.dark-mode section[style*="background-color: white"],
      #merchghost-dashboard-wrapper.dark-mode section[style*="background: white"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #ffffff"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #ffffff"] {
        background-color: #0a0a0a !important;
      }
      #merchghost-dashboard-wrapper.dark-mode [style*="background: linear-gradient"][style*="#ffffff"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: linear-gradient"][style*="white"] {
        background: linear-gradient(to bottom, #1a1a1a, #0a0a0a) !important;
      }
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #f9fafb"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #f9fafb"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #fafafa"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #fafafa"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #f3f4f6"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #f3f4f6"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #eff6ff"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #eff6ff"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #fef3c7"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #fef3c7"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #d1fae5"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #d1fae5"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #fee2e2"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #fee2e2"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background-color: #fce7f3"],
      #merchghost-dashboard-wrapper.dark-mode [style*="background: #fce7f3"] {
        background-color: #1a1a1a !important;
      }
      #merchghost-dashboard-wrapper.dark-mode [style*="color: #333"],
      #merchghost-dashboard-wrapper.dark-mode [style*="color: #313131"],
      #merchghost-dashboard-wrapper.dark-mode [style*="color: rgb(51, 51, 51)"],
      #merchghost-dashboard-wrapper.dark-mode [style*="color: rgb(49, 49, 49)"] {
        color: #e5e5e5 !important;
      }
      #merchghost-dashboard-wrapper.dark-mode [style*="border-color: #e5e7eb"],
      #merchghost-dashboard-wrapper.dark-mode [style*="border-color: rgb(229, 231, 235)"],
      #merchghost-dashboard-wrapper.dark-mode [style*="border-color: #e0e0e0"],
      #merchghost-dashboard-wrapper.dark-mode [style*="border-color: #efefef"],
      #merchghost-dashboard-wrapper.dark-mode [style*="border-color: #d1d5db"] {
        border-color: #2a2a2a !important;
      }
      #merchghost-dashboard-wrapper.dark-mode [style*="color: #666"],
      #merchghost-dashboard-wrapper.dark-mode [style*="color: #999"],
      #merchghost-dashboard-wrapper.dark-mode [style*="color: #959595"],
      #merchghost-dashboard-wrapper.dark-mode [style*="color: #888"],
      #merchghost-dashboard-wrapper.dark-mode [style*="color: #9ca3af"] {
        color: #b0b0b0 !important;
      }
      #merchghost-dashboard-wrapper.dark-mode [style*="color: #656565"] {
        color: #a0a0a0 !important;
      }
      #merchghost-dashboard-wrapper.dark-mode table,
      #merchghost-dashboard-wrapper.dark-mode thead,
      #merchghost-dashboard-wrapper.dark-mode tbody,
      #merchghost-dashboard-wrapper.dark-mode tr,
      #merchghost-dashboard-wrapper.dark-mode td,
      #merchghost-dashboard-wrapper.dark-mode th {
        background-color: #0a0a0a !important;
        color: #e5e5e5 !important;
        border-color: #2a2a2a !important;
      }
      #merchghost-dashboard-wrapper.dark-mode button[style*="background: white"],
      #merchghost-dashboard-wrapper.dark-mode button[style*="background-color: white"],
      #merchghost-dashboard-wrapper.dark-mode button[style*="background: #f3f4f6"],
      #merchghost-dashboard-wrapper.dark-mode button[style*="background-color: #f3f4f6"] {
        background-color: #1a1a1a !important;
        color: #e5e5e5 !important;
      }
      #merchghost-dashboard-wrapper.dark-mode input[type="radio"],
      #merchghost-dashboard-wrapper.dark-mode input[type="checkbox"] {
        background-color: #1a1a1a !important;
        border-color: #404040 !important;
      }
      #merchghost-dashboard-wrapper.dark-mode #merchghost-dashboard-container,
      #merchghost-dashboard-wrapper.dark-mode #merchghost-dashboard-content {
        background-color: #0a0a0a !important;
      }
      #merchghost-dashboard-wrapper.dark-mode .merchghost-status-bar,
      #merchghost-dashboard-wrapper.dark-mode .dash-top-stats,
      #merchghost-dashboard-wrapper.dark-mode .merchghost-container {
        background-color: #0a0a0a !important;
      }
      #merchghost-dashboard-wrapper.dark-mode #summary-statistics-section,
      #merchghost-dashboard-wrapper.dark-mode #designs-with-sales-section,
      #merchghost-dashboard-wrapper.dark-mode #no-sales-card,
      #merchghost-dashboard-wrapper.dark-mode #today-sales-card,
      #merchghost-dashboard-wrapper.dark-mode #level-card,
      #merchghost-dashboard-wrapper.dark-mode #sales-chart-container {
        background-color: #0a0a0a !important;
      }
      #merchghost-dashboard-wrapper.dark-mode [id*="card"],
      #merchghost-dashboard-wrapper.dark-mode [class*="card"] {
        background-color: #0a0a0a !important;
      }
      .dark-mode-modal [style*="background: white"],
      .dark-mode-modal [style*="background-color: white"],
      .dark-mode-modal [style*="background: #fff"],
      .dark-mode-modal [style*="background-color: #fff"],
      .dark-mode-modal [style*="background: #ffffff"],
      .dark-mode-modal [style*="background-color: #ffffff"] {
        background-color: #0a0a0a !important;
        color: #e5e5e5 !important;
      }
      .dark-mode-modal > div[style*="border-radius: 12px"] {
        border: 2px solid #10b981 !important;
      }
      .dark-mode-modal [style*="background-color: #eff6ff"],
      .dark-mode-modal [style*="background-color: #fef3c7"],
      .dark-mode-modal [style*="background-color: #d1fae5"],
      .dark-mode-modal [style*="background-color: #fee2e2"],
      .dark-mode-modal [style*="background-color: #fce7f3"],
      .dark-mode-modal [style*="background-color: #ecfdf5"] {
        background-color: #1a1a1a !important;
      }
      .dark-mode-modal [style*="color: #111827"],
      .dark-mode-modal [style*="color: #333"],
      .dark-mode-modal [style*="color: #313131"] {
        color: #e5e5e5 !important;
      }
      .dark-mode-modal [style*="color: #6b7280"],
      .dark-mode-modal [style*="color: #999"],
      .dark-mode-modal [style*="color: #666"],
      .dark-mode-modal [style*="color: #374151"],
      .dark-mode-modal [style*="color: #495057"] {
        color: #b0b0b0 !important;
      }
      .dark-mode-modal [style*="border-color: #e5e7eb"],
      .dark-mode-modal [style*="border-color: #ddd"],
      .dark-mode-modal [style*="border-color: #dee2e6"] {
        border-color: #2a2a2a !important;
      }
      .dark-mode-modal button[style*="background: #f3f4f6"],
      .dark-mode-modal button[style*="background-color: #f3f4f6"],
      .dark-mode-modal button[style*="background: white"],
      .dark-mode-modal button[style*="background-color: white"] {
        background-color: #1a1a1a !important;
        color: #e5e5e5 !important;
      }
      .dark-mode-modal table,
      .dark-mode-modal td,
      .dark-mode-modal th,
      .dark-mode-modal tr {
        background-color: #0a0a0a !important;
        color: #e5e5e5 !important;
      }
    `}else{t.classList.add("light-mode"),t.classList.remove("dark-mode"),t.style.background="white",t.style.color="#313131",j(),q(),P(),A();let e=document.querySelector("header")||document.querySelector('[role="banner"]');if(e){e.classList.remove("dark-mode"),e.style.removeProperty("background-color"),e.style.removeProperty("color");let t=e.querySelectorAll("*");t.forEach(e=>{let t=e.style;("#0a0a0a"===t.backgroundColor||"#1a1a1a"===t.backgroundColor||"#2a2a2a"===t.backgroundColor||"rgb(10, 10, 10)"===t.backgroundColor||"rgb(26, 26, 26)"===t.backgroundColor||"rgb(42, 42, 42)"===t.backgroundColor)&&t.removeProperty("background-color"),("#e5e5e5"===t.color||"#b0b0b0"===t.color||"#a0a0a0"===t.color||"rgb(229, 229, 229)"===t.color||"rgb(176, 176, 176)"===t.color)&&t.removeProperty("color"),("#2a2a2a"===t.borderColor||"#404040"===t.borderColor)&&t.removeProperty("border-color")})}let o=document.querySelector("footer")||document.querySelector('[class*="footer"]')||document.querySelector('[class*="Footer"]');if(o){o.classList.remove("dark-mode"),o.style.removeProperty("background-color"),o.style.removeProperty("color");let e=o.querySelectorAll("*");e.forEach(e=>{let t=e.style;("#0a0a0a"===t.backgroundColor||"#1a1a1a"===t.backgroundColor||"#2a2a2a"===t.backgroundColor||"rgb(10, 10, 10)"===t.backgroundColor||"rgb(26, 26, 26)"===t.backgroundColor||"rgb(42, 42, 42)"===t.backgroundColor)&&t.removeProperty("background-color"),("#e5e5e5"===t.color||"#b0b0b0"===t.color||"#a0a0a0"===t.color||"rgb(229, 229, 229)"===t.color||"rgb(176, 176, 176)"===t.color)&&t.removeProperty("color"),("#2a2a2a"===t.borderColor||"#404040"===t.borderColor)&&t.removeProperty("border-color")})}let r=t.querySelectorAll("*");r.forEach(e=>{let t=e.style;("#0a0a0a"===t.backgroundColor||"#1a1a1a"===t.backgroundColor||"#2a2a2a"===t.backgroundColor||"rgb(10, 10, 10)"===t.backgroundColor||"rgb(26, 26, 26)"===t.backgroundColor||"rgb(42, 42, 42)"===t.backgroundColor)&&t.removeProperty("background-color"),("#e5e5e5"===t.color||"#b0b0b0"===t.color||"#a0a0a0"===t.color||"rgb(229, 229, 229)"===t.color||"rgb(176, 176, 176)"===t.color)&&t.removeProperty("color"),("#2a2a2a"===t.borderColor||"#404040"===t.borderColor)&&t.removeProperty("border-color")});let i=document.getElementById("dark-mode-style");i&&i.remove()}}}async function T(){try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";if("dark"===t)return chrome.runtime.getURL("assets/Darklogo-footer@2x.png");return chrome.runtime.getURL("assets/Lightogo-footer@2x.png")}catch(e){return chrome.runtime.getURL("assets/Lightogo-footer@2x.png")}}async function M(){try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";if("dark"===t)return chrome.runtime.getURL("assets/Darkdashboard.png");return chrome.runtime.getURL("assets/Lightdashboard.png")}catch(e){return chrome.runtime.getURL("assets/Lightdashboard.png")}}async function D(){try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";if("dark"===t)return chrome.runtime.getURL("assets/Darkchart.png");return chrome.runtime.getURL("assets/Lightchart.png")}catch(e){return chrome.runtime.getURL("assets/Lightchart.png")}}async function I(){try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";if("dark"===t)return chrome.runtime.getURL("assets/Darklink-building.png");return chrome.runtime.getURL("assets/Lightlink-building.png")}catch(e){return chrome.runtime.getURL("assets/Lightlink-building.png")}}async function j(){try{let e=await T(),t=document.querySelectorAll('img[src*="Darklogo-footer@2x.png"], img[src*="Lightogo-footer@2x.png"]');t.forEach(t=>{t.src=e})}catch(e){}}async function q(){try{let e=await M(),t=document.querySelectorAll('img[src*="dashboard.png"], img[src*="Darkdashboard.png"], img[src*="Lightdashboard.png"]');t.forEach(t=>{t.src=e})}catch(e){}}async function P(){try{let e=await D(),t=document.querySelectorAll('img[src*="chart.png"], img[src*="Darkchart.png"], img[src*="Lightchart.png"]');t.forEach(t=>{t.src=e})}catch(e){}}async function A(){try{let e=await I(),t=document.querySelectorAll('img[src*="link-building.png"], img[src*="Darklink-building.png"], img[src*="Lightlink-building.png"]');t.forEach(t=>{t.src=e})}catch(e){}}async function U(){try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";L(t),await j(),await q(),await P(),await A()}catch(e){}}async function _(e){try{let t=await chrome.storage.local.get(["theme"]),o="dark"===t.theme?"dark":"light";if("dark"===o){e.classList.add("dark-mode-modal");let t=e.querySelector('div[style*="background: white"], div[style*="background-color: white"]');t&&(t.style.backgroundColor="#0a0a0a",t.style.color="#e5e5e5",t.style.border&&"none"!==t.style.border||(t.style.border="2px solid #10b981"));let o=e.querySelectorAll("*");o.forEach(e=>{let t=e.style,o=window.getComputedStyle(e),r=o.backgroundColor,i=t.backgroundColor||"";("rgb(255, 255, 255)"===r||"white"===i||"#fff"===i||"#ffffff"===i||i.includes("white")||"white"===t.background||"#fff"===t.background||"#ffffff"===t.background)&&(t.backgroundColor="#0a0a0a",t.background&&t.background.includes("white")&&(t.background="#0a0a0a")),("#eff6ff"===i||"#fef3c7"===i||"#d1fae5"===i||"#fee2e2"===i||"#fce7f3"===i||"#f9fafb"===i||"#fafafa"===i||"#f3f4f6"===i||"#ecfdf5"===i)&&(t.backgroundColor="#1a1a1a");let l=["#3b82f6","#d97706","#059669","#dc2626","#ec4899","#1e3a8a","#92400e","#047857","#991b1b","#9f1239"].includes(t.color);l||"#333"!==t.color&&"#313131"!==t.color&&"#111827"!==t.color&&"rgb(51, 51, 51)"!==t.color&&"rgb(49, 49, 49)"!==t.color&&"rgb(17, 24, 39)"!==t.color||(t.color="#e5e5e5"),("#666"===t.color||"#999"===t.color||"#959595"===t.color||"#888"===t.color||"#9ca3af"===t.color||"#656565"===t.color||"#6b7280"===t.color||"#374151"===t.color||"#495057"===t.color)&&(t.color="#b0b0b0"),("#e5e7eb"===t.borderColor||"#e0e0e0"===t.borderColor||"#efefef"===t.borderColor||"#d1d5db"===t.borderColor||"#ddd"===t.borderColor||"#dee2e6"===t.borderColor)&&(t.borderColor="#2a2a2a"),("#f3f4f6"===t.background||"#f3f4f6"===t.backgroundColor||"white"===t.background||"white"===t.backgroundColor)&&("BUTTON"===e.tagName||"button"===e.tagName)&&(t.backgroundColor="#1a1a1a",t.background&&(t.background="#1a1a1a")),("TABLE"===e.tagName||"TD"===e.tagName||"TH"===e.tagName||"TR"===e.tagName)&&("rgb(255, 255, 255)"===r||"white"===i||"#fff"===i||"#ffffff"===i)&&(t.backgroundColor="#0a0a0a")})}}catch(e){}}async function F(e,t,o){let r=document.getElementById("sales-modal-overlay");r&&r.remove();let l=t.reduce((e,t)=>e+(t.quantity||1),0),a=t.filter(e=>!e.isCancelled).reduce((e,t)=>e+(t.quantity||1),0),n=t.filter(e=>e.isCancelled).reduce((e,t)=>e+(t.quantity||1),0),s=t.filter(e=>!e.isCancelled).reduce((e,t)=>e+(t.artistMargin||t.netProfit||0),0);t.reduce((e,t)=>e+(t.retailPrice||t.price||0)*(t.quantity||1),0);let d=await C(t),c=d.totalFees,p={};t.forEach(e=>{let t=e.workId;p[t]||(p[t]={quantity:0,title:e.workTitle}),p[t].quantity+=e.quantity||1}),Object.values(p).sort((e,t)=>t.quantity-e.quantity)[0];let g=e;e.match(/^\d{4}-\d{2}-\d{2}$/)&&(g=new Date(e+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}));let h=document.createElement("div");h.id="sales-modal-overlay",h.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Lato', sans-serif;
  `;let m=document.createElement("div");m.style.cssText=`
    background: white;
    border: 2px solid #10b981;
    border-radius: 12px;
    max-width: 700px;
    width: 100%;
    max-height: 85vh;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    position: relative;
  `;let u=new Map;t.forEach(e=>{let t=e.productType||e.product||"Unknown",r=`${e.workId}|${t}`;if(!u.has(r)){let i=o.get(e.workId);u.set(r,{workId:e.workId,productType:t,workTitle:e.workTitle||"Untitled",totalQuantity:0,totalSold:0,totalCancelled:0,totalRoyalties:0,thumbnailUrl:i?.thumbnailUrl||"",editUrl:e.editUrl||i?.editUrl||"",url:i?.url||"",netProfit:0})}let i=u.get(r),l=e.quantity||1;i.totalQuantity+=l,e.isCancelled?i.totalCancelled+=l:i.totalSold+=l,i.totalRoyalties+=e.artistMargin||e.netProfit||0});let f=Array.from(u.values()).sort((e,t)=>t.totalQuantity-e.totalQuantity),b=await Promise.all(f.map(async e=>{let o=t.filter(t=>{let o=t.productType||t.product||"Unknown",r=`${t.workId}|${o}`;return r===`${e.workId}|${e.productType}`}),r=await C(o);return e.totalRoyalties-r.totalFees}));f.forEach((e,t)=>{e.netProfit=b[t]||0}),window.__salesModalGroupedCount=f.length;let x=await T(),y=H("blur_switch_sales_modal",!0),v=y.outerHTML;m.innerHTML=`
    <!-- Header -->
    <div style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">Sales: ${g}</h2>
      <button id="close-modal-btn" style="background: #f3f4f6; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="pointer-events: none;">
          <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Statistics Cards - Auto Width (Content-Based) -->
    <div style="padding: 8px 16px 6px; display: flex; gap: 0; flex-shrink: 0; flex-wrap: wrap;">
      <!-- Sales Card -->
      <div style="border: 2px solid #93c5fd; border-right: 1px solid #93c5fd; border-radius: 8px 0 0 0; padding: 8px 12px; background: #eff6ff; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 11px; color: #3b82f6; margin-bottom: 4px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Sales</div>
        <div class="auto-resize-number" style="font-size: 28px; font-weight: 700; color: #1e3a8a; line-height: 1;">${a}</div>
      </div>
      
      <!-- Cancelled Card -->
      <div style="border-top: 2px solid #fbbf24; border-bottom: 2px solid #fbbf24; border-left: 1px solid #fbbf24; border-right: 1px solid #fbbf24; padding: 12px 16px; background: #fef3c7; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 12px; color: #d97706; margin-bottom: 6px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Cancelled</div>
        <div class="auto-resize-number" style="font-size: 32px; font-weight: 700; color: #92400e; line-height: 1;">${n}</div>
      </div>
      
      <!-- Royalties Card -->
      <div style="border-top: 2px solid #10b981; border-bottom: 2px solid #10b981; border-left: 1px solid #10b981; border-right: 1px solid #10b981; padding: 12px 16px; background: #d1fae5; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 12px; color: #059669; margin-bottom: 6px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Royalties</div>
        <div class="auto-resize-number" style="font-size: 28px; font-weight: 700; color: #047857; line-height: 1;">$${s.toFixed(2)}</div>
      </div>
      
      <!-- Fees Card -->
      <div style="border-top: 2px solid #ef4444; border-bottom: 2px solid #ef4444; border-left: 1px solid #ef4444; border-right: 1px solid #ef4444; padding: 12px 16px; background: #fee2e2; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 12px; color: #dc2626; margin-bottom: 6px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Fees</div>
        <div class="auto-resize-number" style="font-size: 28px; font-weight: 700; color: #991b1b; line-height: 1;">$${c.toFixed(2)}</div>
      </div>
      
      <!-- Net Profit Card -->
      <div style="border: 2px solid #f9a8d4; border-left: 1px solid #f9a8d4; border-radius: 0 8px 0 0; padding: 12px 16px; background: #fce7f3; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 12px; color: #ec4899; margin-bottom: 6px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Net Profit</div>
        <div class="auto-resize-number" style="font-size: 24px; font-weight: 700; color: #9f1239; line-height: 1;">$${(s-c).toFixed(2)}</div>
      </div>
    </div>

    <div style="padding: 0 16px 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <div style="font-size: 12px; font-weight: 600; color: #374151;">Top Products</div>
        <button id="view-all-products-btn" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background-color: transparent; border: none; cursor: pointer; opacity: 0.6; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="View all products">
          <span style="font-size: 15px; color: #999;">\u2630</span>
        </button>
      </div>
      ${(()=>{let e={};t.forEach(t=>{let o=t.productType||t.product||"Unknown";e[o]=(e[o]||0)+(t.quantity||1)});let o=Object.entries(e).sort((e,t)=>t[1]-e[1]).slice(0,3);return 0===o.length?'<div style="text-align: center; color: #9ca3af; padding: 10px; font-size: 11px;">No products</div>':o.map(([e,t])=>{let o=Math.round(t/l*100);return`
            <div style="margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <span style="font-size: 11px; font-weight: 500; color: #374151; text-transform: uppercase;">${e}</span>
                <span style="font-size: 11px; font-weight: 600; color: #6b7280;">${o}% <span style="color: #9ca3af; font-weight: 400;">(${t})</span></span>
              </div>
              <div style="width: 100%; height: 4px; background: #f3f4f6; border-radius: 2px; overflow: hidden;">
                <div style="width: ${o}%; height: 100%; background: linear-gradient(90deg, #fbbf24, #f59e0b); border-radius: 2px;"></div>
              </div>
            </div>
          `}).join("")})()}
    </div>

    <!-- Sales Table -->
    <div style="padding: 0 16px 12px; flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
      <!-- Screenshot Switch -->
      <div style="margin-bottom: 6px; display: flex; gap: 6px; align-items: center; flex-shrink: 0; justify-content: flex-end;">
        ${v}
      </div>

      <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; max-height: 300px; display: flex; flex-direction: column; min-height: 0;">
        <div style="overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed; max-width: 100%;">
            <thead style="position: sticky; top: 0; background: #f9fafb; z-index: 1;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <th style="padding: 8px 10px; text-align: left; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Title</th>
                <th style="padding: 8px 10px; text-align: center; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 15%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Product</th>
                <th style="padding: 8px 10px; text-align: center; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 15%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Sales</th>
                <th style="padding: 8px 10px; text-align: center; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 20%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Royalties</th>
                <th style="padding: 8px 10px; text-align: center; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 10%; overflow: hidden;"></th>
              </tr>
            </thead>
            <tbody>
              ${f.map((e,t)=>`
                  <tr style="border-bottom: 1px solid #f3f4f6; transition: background 0.1s;" 
                      onmouseover="this.style.background='#f9fafb'" 
                      onmouseout="this.style.background='white'">
                    <td style="padding: 6px 10px; overflow: hidden; text-overflow: ellipsis; max-width: 0; width: 40%;">
                      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%;">
                        <div class="hide-in-screenshot image-preview-container" data-image-url="${(0,i.getBunnyThumbnailUrl)(e.imageUrl||e.thumbnailUrl||"")}" style="width: 36px; height: 36px; background: #808080; border: 1px solid #e5e7eb; border-radius: 4px; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer;">
                          ${e.imageUrl||e.thumbnailUrl?`
                            <img src="${(0,i.getBunnyThumbnailUrl)(e.imageUrl||e.thumbnailUrl||"")}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<span style=\\'font-size: 16px;\\'>\ud83c</span>'">
                          `:'<span style="font-size: 16px;">\uD83C\uDFA8</span>'}
                        </div>
                        <div style="min-width: 0; flex: 1; overflow: hidden; max-width: 100%;">
                          ${e.url?`
                            <a href="${e.url}" target="_blank" class="hide-in-screenshot" style="font-size: 11px; font-weight: 500; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; max-width: 100%; text-decoration: none; cursor: pointer;" onmouseover="this.style.color='#10b981'; this.style.textDecoration='underline';" onmouseout="this.style.color='#6b7280'; this.style.textDecoration='none';">${e.workTitle}</a>
                          `:`
                            <div class="hide-in-screenshot" style="font-size: 11px; font-weight: 500; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; max-width: 100%;">${e.workTitle}</div>
                          `}
                        </div>
                      </div>
                    </td>
                    <td style="padding: 6px 10px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      <div style="font-size: 10px; color: #6b7280; text-transform: capitalize; font-weight: 500;">${e.productType}</div>
                    </td>
                    <td style="padding: 6px 10px; text-align: center; overflow: hidden;">
                      <div style="font-size: clamp(12px, 1.5vw, 14px); font-weight: 700; color: #6b7280; line-height: 1.2; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.totalQuantity}</div>
                      <div style="font-size: 9px; color: #6b7280; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.totalSold}-${e.totalCancelled}</div>
                    </td>
                    <td style="padding: 6px 10px; text-align: center; overflow: hidden;">
                      <div style="font-size: clamp(11px, 1.4vw, 13px); font-weight: 700; color: #047857; line-height: 1.2; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">$${e.totalRoyalties.toFixed(2)}</div>
                      <div style="font-size: 9px; color: #9f1239; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">$${e.netProfit.toFixed(2)}</div>
                    </td>
                    <td style="padding: 6px 10px; text-align: center; overflow: hidden;">
                      ${e.editUrl?`
                        <a href="${e.editUrl}" target="_blank" style="color: #f59e0b; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;" title="Edit design">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354L11.427 2.487zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.25.25 0 00.108-.064l6.286-6.286z"/>
                          </svg>
                        </a>
                      `:"-"}
                    </td>
                  </tr>
                `).join("")}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Summary Text -->
      <div style="text-align: center; padding: 8px 0 4px; color: #9ca3af; font-size: 11px; font-weight: 400;">
        ${(()=>{let e=window.__salesModalGroupedCount||new Set(t.map(e=>`${e.workId}|${e.productType||e.product||"Unknown"}`)).size;return delete window.__salesModalGroupedCount,`${l} sale${1!==l?"s":""} from ${e} unique product${1!==e?"s":""}`})()}
      </div>
      
      <!-- Logo Footer Only -->
      <div style="display: flex; justify-content: flex-start; padding: 0 16px 0;">
        <img src="${x}" style="height: 24px; width: auto; opacity: 0.8;" onerror="this.style.display='none'">
      </div>
    </div>
  `,h.appendChild(m),document.body.appendChild(h),setTimeout(()=>{_(h)},50);let w=window.__applyScreenshotMode,k=window.__getSavedScreenshotMode;if(w&&k){let e=k();e&&w(e)}let $=m.querySelector("#view-all-products-btn");if($){let e=$.__viewAllClickHandler;e&&$.removeEventListener("click",e);let o=e=>{e.preventDefault(),e.stopPropagation(),function(e,t){let o=document.getElementById("all-products-modal-overlay");o&&o.remove();let r={};e.forEach(e=>{let t=e.productType||e.product||"Unknown";r[t]=(r[t]||0)+(e.quantity||1)});let i=Object.entries(r).map(([e,t])=>({product:e,count:t})).sort((e,t)=>t.count-e.count);if(0===i.length)return;let l=document.createElement("div");if(l.id="all-products-modal-overlay",l.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999999;
      display: flex;
      align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Lato', sans-serif;
    `,!document.getElementById("all-products-modal-scrollbar-style")){let e=document.createElement("style");e.id="all-products-modal-scrollbar-style",e.textContent=`
      #all-products-modal-overlay .products-scrollable::-webkit-scrollbar {
        width: 6px;
      }
      #all-products-modal-overlay .products-scrollable::-webkit-scrollbar-track {
        background: #f3f4f6;
        border-radius: 3px;
      }
      #all-products-modal-overlay .products-scrollable::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
      }
      #all-products-modal-overlay .products-scrollable::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }
      #all-products-modal-overlay .products-scrollable {
        scrollbar-width: thin;
        scrollbar-color: #d1d5db #f3f4f6;
      }
    `,document.head.appendChild(e)}let a=document.createElement("div");a.style.cssText=`
    background: white;
    border: 2px solid #10b981;
    border-radius: 12px;
    max-width: 400px;
    width: 100%;
    max-height: 85vh;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  `,a.innerHTML=`
    <!-- Header -->
    <div style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">All Products</h2>
      <button id="close-all-products-modal-btn" style="background: #f3f4f6; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="pointer-events: none;">
          <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      </div>

    <div style="padding: 12px 16px; overflow-x: hidden;">
      <div class="products-scrollable" style="max-height: 240px; overflow-y: auto; overflow-x: hidden; padding-right: 8px;">
        ${i.map(({product:e,count:o})=>{let r=o/t*100,i=r<1?r.toFixed(1):Math.round(r);return`
          <div style="margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 500; color: #374151; text-transform: uppercase;">${e}</span>
              <span style="font-size: 11px; font-weight: 600; color: #6b7280;">${i}% <span style="color: #9ca3af; font-weight: 400;">(${o})</span></span>
            </div>
            <div style="width: 100%; height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden;">
              <div style="width: ${r<.5?.5:r}%; height: 100%; background: linear-gradient(90deg, #fbbf24, #f59e0b); border-radius: 3px;"></div>
            </div>
          </div>
        `}).join("")}
    </div>
  `,l.appendChild(a),document.body.appendChild(l),setTimeout(()=>{_(l)},50);let n=a.querySelector("#close-all-products-modal-btn");n&&(n.addEventListener("click",e=>{e.preventDefault(),e.stopPropagation(),l.remove()}),n.addEventListener("mouseenter",()=>{n.style.background="#e5e7eb"}),n.addEventListener("mouseleave",()=>{n.style.background="#f3f4f6"})),l.addEventListener("click",e=>{e.target===l&&l.remove()})}(t,l)};$.addEventListener("click",o),$.__viewAllClickHandler=o}setTimeout(()=>{let e=m.querySelectorAll(".auto-resize-number");e.forEach(e=>{let t=e.parentElement;if(!t)return;let o=t.getBoundingClientRect().width-16,r=parseFloat(window.getComputedStyle(e).fontSize),i=r,l=document.createElement("span");l.style.cssText=`position: absolute; visibility: hidden; white-space: nowrap; font-size: ${r}px; font-weight: 700; font-family: 'Lato', sans-serif;`,l.textContent=e.textContent||"",document.body.appendChild(l);let a=l.getBoundingClientRect().width;document.body.removeChild(l),a>o&&r>10&&(r=Math.max(10,o/a*i*.95),e.style.fontSize=`${r}px`)})},50);let S=m.querySelectorAll(".edit-btn");S.forEach(e=>{e.addEventListener("click",()=>{let t=e.dataset.url;t&&window.open(t,"_blank")})});let E=document.getElementById("close-modal-btn");E&&(E.addEventListener("mouseover",()=>{E.style.background="#e5e7eb"}),E.addEventListener("mouseout",()=>{E.style.background="#f3f4f6"}),E.addEventListener("click",()=>{h.remove()})),Z(m),h.addEventListener("click",e=>{e.target===h&&h.remove()})}async function B(e){let t=document.getElementById("works-modal-overlay");t&&t.remove();let o=[...e].sort((e,t)=>(t.totalQuantity||0)-(e.totalQuantity||0)),r=o.reduce((e,t)=>e+(t.totalQuantity||0),0),l=o.reduce((e,t)=>e+(t.totalMargin||0),0),a=document.createElement("div");a.id="works-modal-overlay",a.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Lato', sans-serif;
  `;let n=document.createElement("div");n.style.cssText=`
    background: white;
    border: 2px solid #10b981;
    border-radius: 12px;
    max-width: 700px;
    width: 100%;
    max-height: 85vh;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    position: relative;
  `;let s=await T(),d=H("blur_switch_works_modal",!0),c=d.outerHTML;n.innerHTML=`
    <!-- Header -->
    <div style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">All Time</h2>
      <button id="close-works-modal-btn" style="background: #f3f4f6; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="pointer-events: none;">
          <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div style="padding: 8px 16px 6px; display: flex; gap: 0; flex-shrink: 0; flex-wrap: wrap;">
      <!-- Sales Card -->
      <div style="border: 2px solid #93c5fd; border-right: 1px solid #93c5fd; border-radius: 8px 0 0 0; padding: 8px 12px; background: #eff6ff; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 11px; color: #3b82f6; margin-bottom: 4px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Sales</div>
        <div class="auto-resize-number" style="font-size: 28px; font-weight: 700; color: #1e3a8a; line-height: 1;">${r}</div>
      </div>
      
      <!-- Royalties Card -->
      <div style="border: 2px solid #10b981; border-left: 1px solid #10b981; border-radius: 0 8px 0 0; padding: 8px 12px; background: #d1fae5; flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 11px; color: #059669; margin-bottom: 4px; text-transform: capitalize; font-weight: 600; white-space: nowrap;">Royalties</div>
        <div class="auto-resize-number" style="font-size: 24px; font-weight: 700; color: #047857; line-height: 1;">$${l.toFixed(2)}</div>
      </div>
    </div>

    <div style="padding: 0 16px 12px; flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
      <!-- Screenshot Switch -->
      <div style="margin-bottom: 6px; display: flex; gap: 6px; align-items: center; flex-shrink: 0; justify-content: flex-end;">
        ${c}
      </div>

      <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; max-height: 300px; display: flex; flex-direction: column; min-height: 0;">
        <div style="overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed; max-width: 100%;">
            <thead style="position: sticky; top: 0; background: #f9fafb; z-index: 1;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <th style="padding: 8px 10px; text-align: left; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Title</th>
                <th style="padding: 8px 10px; text-align: center; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 20%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Sales</th>
                <th style="padding: 8px 10px; text-align: center; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 20%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Royalties</th>
              </tr>
            </thead>
            <tbody>
              ${o.map(e=>`
                <tr style="border-bottom: 1px solid #f3f4f6; transition: background 0.1s;" 
                    onmouseover="this.style.background='#f9fafb'" 
                    onmouseout="this.style.background='white'">
                  <td style="padding: 6px 10px; overflow: hidden; text-overflow: ellipsis; max-width: 0; width: 60%;">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%;">
                      <div class="hide-in-screenshot image-preview-container" data-image-url="${(0,i.getBunnyThumbnailUrl)(e.imageUrl||e.thumbnailUrl||"")}" style="width: 36px; height: 36px; background: #808080; border: 1px solid #e5e7eb; border-radius: 4px; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer;">
                        ${e.imageUrl||e.thumbnailUrl?`
                          <img src="${(0,i.getBunnyThumbnailUrl)(e.imageUrl||e.thumbnailUrl||"")}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<span style=\\'font-size: 16px;\\'>\ud83c</span>'">
                        `:'<span style="font-size: 16px;">\uD83C\uDFA8</span>'}
                      </div>
                      <div style="min-width: 0; flex: 1; overflow: hidden; max-width: 100%;">
                        ${e.url||e.editUrl?`
                          <a href="${e.url||e.editUrl}" target="_blank" class="hide-in-screenshot" style="font-size: 11px; font-weight: 500; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; max-width: 100%; text-decoration: none; cursor: pointer;" onmouseover="this.style.color='#10b981'; this.style.textDecoration='underline';" onmouseout="this.style.color='#6b7280'; this.style.textDecoration='none';">${e.title||"Untitled"}</a>
                        `:`
                          <div class="hide-in-screenshot" style="font-size: 11px; font-weight: 500; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; max-width: 100%;">${e.title||"Untitled"}</div>
                        `}
                      </div>
                    </div>
                  </td>
                  <td style="padding: 6px 10px; text-align: center; overflow: hidden;">
                    <div style="font-size: clamp(12px, 1.5vw, 14px); font-weight: 700; color: #6b7280; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.totalQuantity||0}</div>
                  </td>
                  <td style="padding: 6px 10px; text-align: center; overflow: hidden;">
                    <div style="font-size: clamp(11px, 1.4vw, 13px); font-weight: 700; color: #047857; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">$${(e.totalMargin||0).toFixed(2)}</div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Summary Text -->
      <div style="text-align: center; padding: 8px 0 4px; color: #9ca3af; font-size: 11px; font-weight: 400;">
        ${r} sale${1!==r?"s":""} from ${o.length} unique work${1!==o.length?"s":""}
      </div>
      
      <!-- Logo Footer -->
      <div style="display: flex; justify-content: flex-start; padding: 0 16px 0;">
        <img src="${s}" style="height: 24px; width: auto; opacity: 0.8;" onerror="this.style.display='none'">
      </div>
    </div>
  `,a.appendChild(n),document.body.appendChild(a),setTimeout(()=>{_(a)},50);let p=window.__applyScreenshotMode,g=window.__getSavedScreenshotMode;if(p&&g){let e=g();e&&p(e)}setTimeout(()=>{let e=n.querySelectorAll(".auto-resize-number");e.forEach(e=>{let t=e.parentElement;if(!t)return;let o=t.getBoundingClientRect().width-16,r=parseFloat(window.getComputedStyle(e).fontSize),i=r,l=document.createElement("span");l.style.cssText=`position: absolute; visibility: hidden; white-space: nowrap; font-size: ${r}px; font-weight: 700; font-family: 'Lato', sans-serif;`,l.textContent=e.textContent||"",document.body.appendChild(l);let a=l.getBoundingClientRect().width;document.body.removeChild(l),a>o&&r>10&&(r=Math.max(10,o/a*i*.95),e.style.fontSize=`${r}px`)})},50);let h=document.getElementById("close-works-modal-btn");h&&(h.addEventListener("mouseover",()=>{h.style.background="#e5e7eb"}),h.addEventListener("mouseout",()=>{h.style.background="#f3f4f6"}),h.addEventListener("click",()=>{a.remove()})),Z(n),a.addEventListener("click",e=>{e.target===a&&a.remove()})}function H(e,t=!1){let o=document.createElement("div");o.className="screenshot-switch-wrapper clearfix"+(t?" inline-flex":""),t?o.style.cssText="display: flex; align-items: center; gap: 6px;":o.style.cssText="position: absolute; right: 0; bottom: 0;",o.setAttribute("data-toggle","tooltip"),o.setAttribute("data-html","true"),o.setAttribute("title",""),o.setAttribute("data-original-title","Screenshot Mode<br/>Hides titles for screenshot");let r=document.createElement("i");r.className="fa fa-eye-slash screenshot-switch-icon",r.style.cssText="margin-right: 3px; cursor: help;";let i=document.createElement("div");i.className="screenshot-switch-container float-right";let l=document.createElement("label");l.setAttribute("for",e||"blur_switch");let a=document.createElement("input");a.type="checkbox",a.id=e||"blur_switch",a.className="hide-titles screenshot-switch-input";let n=document.createElement("span");return n.className="screenshot-switch-label",l.appendChild(a),l.appendChild(n),i.appendChild(l),o.appendChild(r),o.appendChild(i),o}async function R(){try{let[e,t]=await Promise.all([new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllSales"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})})]);if(!e||!e.success||!e.sales)return;let o=e.sales,r=new Map;t&&t.success&&t.works&&t.works.forEach(e=>{r.set(e.workId,e)});let l=new Map;o.forEach(e=>{if(!e.workId)return;let t=l.get(e.workId),o=e.product||"Unknown",r=e.quantity||1;if(t)t.quantity+=r,e.isCancelled||(t.royalties+=e.artistMargin||e.netProfit||0),t.productStats.set(o,(t.productStats.get(o)||0)+r),t.sales.push(e);else{let t=new Map;t.set(o,r),l.set(e.workId,{quantity:r,royalties:e.isCancelled?0:e.artistMargin||e.netProfit||0,workTitle:e.workTitle||"Unknown",workId:e.workId,editUrl:e.editUrl||"",product:o,productStats:t,sales:[e]})}});let a=Array.from(l.values()).map(e=>{let t=e.product,o=0;return e.productStats.forEach((e,r)=>{e>o&&(o=e,t=r)}),e.product=t,e}).sort((e,t)=>t.quantity-e.quantity),n=await Promise.all(a.map(async e=>{let t=await C(e.sales),o=e.royalties-t.totalFees;return{...e,netProfit:o}}));a=n;let s=document.getElementById("designs-with-sales-section"),d=document.getElementById("designs-with-sales-title"),c=document.getElementById("designs-with-sales-list");if(!s||!d||!c)return;let p=l.size,g=null,h=null;o.forEach(e=>{e.orderDate&&((!g||e.orderDate<g)&&(g=e.orderDate),(!h||e.orderDate>h)&&(h=e.orderDate))});let m="";if(g&&h){let e=e=>{let[t,o]=e.split("-"),r=parseInt(o)-1;return`${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][r]} ${t}`},t=e(g),o=e(h);m=t===o?` (${t})`:` (${t} - ${o})`}let u=d.querySelector(".screenshot-switch-wrapper"),f=u?u.outerHTML:H("blur_switch_designs").outerHTML;if(d.innerHTML=`<span>Design With Sales : ${p}${m}</span>${f}`,d.style.position="relative",0===a.length){c.innerHTML='<div style="text-align: center; color: #999; padding: 20px;">No designs with sales</div>';return}c.innerHTML=a.map((e,t)=>{let o=r.get(e.workId),l=(0,i.getBunnyThumbnailUrl)(o?.imageUrl||o?.thumbnailUrl||""),a=o?.url||"",n=e.editUrl||o?.editUrl||"";return`
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 8px; border-bottom: 1px solid #efefef; background-color: white;">
          
          <div style="text-align: center; min-width: 45px; flex-shrink: 0;">
            <div style="font-size: 22px; font-weight: 700; color: #333; line-height: 1; margin-bottom: 2px;">${e.quantity}</div>
            <div style="font-size: 10px; color: #888; font-weight: 400;">$${e.royalties.toFixed(2)}</div>
          </div>
          
          <div class="hide-in-screenshot image-preview-container" data-image-url="${l}" style="width: 50px; height: 50px; flex-shrink: 0; background-color: #808080; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden; position: relative; cursor: pointer;">
            ${l?`<img src="${l}" style="width: 100%; height: 100%; object-fit: cover;">`:'<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 20px; color: #ccc;">\uD83C\uDFA8</div>'}
          </div>
          
          <div style="flex: 1; min-width: 0; overflow: hidden;">
            ${a?`
              <a href="${a}" target="_blank" class="hide-in-screenshot" style="font-weight: 500; margin-bottom: 3px; font-size: 13px; color: #10b981; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; text-decoration: none; cursor: pointer; display: block;" onmouseover="this.style.textDecoration='underline';" onmouseout="this.style.textDecoration='none';">${e.workTitle}</a>
            `:`
              <div class="hide-in-screenshot" style="font-weight: 500; margin-bottom: 3px; font-size: 13px; color: #10b981; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">${e.workTitle}</div>
            `}
            <div style="color: #999; font-size: 10px; line-height: 1;">Net Profit: <span style="font-weight: 600; color: #9f1239;">$${(e.netProfit||0).toFixed(2)}</span></div>
          </div>
          
          <div style="flex-shrink: 0; margin-left: 4px;">
            <button class="design-products-btn" data-work-id="${e.workId}" data-design-index="${t}"
               style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background-color: transparent; border: none; cursor: pointer; opacity: 0.6; transition: opacity 0.2s;"
               onmouseover="this.style.opacity='1'" 
               onmouseout="this.style.opacity='0.6'"
               title="View all products">
              <span style="font-size: 16px; color: #999;">\u2630</span>
            </button>
          </div>
          
          ${n?`
            <div style="flex-shrink: 0; margin-left: 4px;">
              <a href="${n}" target="_blank" rel="noopener noreferrer" 
                 style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background-color: transparent; border: none; text-decoration: none; cursor: pointer; color: #f59e0b; opacity: 0.6; transition: opacity 0.2s;"
                 onmouseover="this.style.opacity='1'" 
                 onmouseout="this.style.opacity='0.6'"
                 title="Edit design">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354L11.427 2.487zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.25.25 0 00.108-.064l6.286-6.286z"/>
                </svg>
              </a>
            </div>
          `:""}
        </div>
      `}).join("");let b=c.__designProductsClickHandler;b&&c.removeEventListener("click",b);let x=e=>{let t=e.target,o=t.closest(".design-products-btn");if(o){e.preventDefault(),e.stopPropagation();let t=o.getAttribute("data-work-id"),i=parseInt(o.getAttribute("data-design-index")||"0");t&&a[i]&&function(e,t){let o=document.getElementById("design-products-modal-overlay");o&&o.remove();let r=Array.from(e.productStats.entries()).map(([e,t])=>({product:e,count:t})).sort((e,t)=>t.count-e.count);if(0===r.length)return;let i=document.createElement("div");if(i.id="design-products-modal-overlay",i.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10001;
      display: flex;
      align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Lato', sans-serif;
  `,!document.getElementById("design-products-modal-scrollbar-style")){let e=document.createElement("style");e.id="design-products-modal-scrollbar-style",e.textContent=`
      #design-products-modal-overlay .products-scrollable::-webkit-scrollbar {
        width: 6px;
      }
      #design-products-modal-overlay .products-scrollable::-webkit-scrollbar-track {
        background: #f3f4f6;
        border-radius: 3px;
      }
      #design-products-modal-overlay .products-scrollable::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
      }
      #design-products-modal-overlay .products-scrollable::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }
      #design-products-modal-overlay .products-scrollable {
        scrollbar-width: thin;
        scrollbar-color: #d1d5db #f3f4f6;
      }
    `,document.head.appendChild(e)}let l=document.createElement("div");l.style.cssText=`
    background: white;
    border: 2px solid #10b981;
    border-radius: 12px;
    max-width: 400px;
    width: 100%;
    max-height: 85vh;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  `,l.innerHTML=`
    <!-- Header -->
    <div style="padding: 18px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      ${(()=>{let o=t.get(e.workId),r=o?.url||o?.editUrl||"";return r?`
          <a href="${r}" target="_blank" style="margin: 0; font-size: 16px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; text-decoration: none; cursor: pointer;" onmouseover="this.style.color='#10b981'; this.style.textDecoration='underline';" onmouseout="this.style.color='#111827'; this.style.textDecoration='none';">${e.workTitle}</a>
        `:`
          <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;">${e.workTitle}</h2>
        `})()}
      <button id="close-design-products-modal-btn" style="background: #f3f4f6; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="pointer-events: none;">
          <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      </div>

    <div style="padding: 20px; overflow-x: hidden;">
      <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 12px;">Top Products</div>
      <div class="products-scrollable" style="max-height: 280px; overflow-y: auto; overflow-x: hidden; padding-right: 8px;">
        ${r.map(({product:t,count:o})=>{let r=o/e.quantity*100,i=r<1?r.toFixed(1):Math.round(r);return`
          <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 500; color: #374151; text-transform: uppercase;">${t}</span>
              <span style="font-size: 11px; font-weight: 600; color: #6b7280;">${i}% <span style="color: #9ca3af; font-weight: 400;">(${o})</span></span>
            </div>
            <div style="width: 100%; height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden;">
              <div style="width: ${r<.5?.5:r}%; height: 100%; background: linear-gradient(90deg, #fbbf24, #f59e0b); border-radius: 3px;"></div>
            </div>
          </div>
        `}).join("")}
    </div>
  `,i.appendChild(l),document.body.appendChild(i),setTimeout(()=>{_(i)},50);let a=document.getElementById("close-design-products-modal-btn");a&&(a.addEventListener("click",()=>{i.remove()}),a.addEventListener("mouseenter",()=>{a.style.background="#e5e7eb"}),a.addEventListener("mouseleave",()=>{a.style.background="#f3f4f6"})),i.addEventListener("click",e=>{e.target===i&&i.remove()})}(a[i],r)}};c.addEventListener("click",x),c.__designProductsClickHandler=x;let y=window.__applyScreenshotMode,v=window.__getSavedScreenshotMode;if(y&&v){let e=v();e&&y(e)}let w=document.getElementById("designs-with-sales-section");w&&Z(w),setTimeout(()=>{chrome.storage.local.get(["theme"]).then(e=>{let t="dark"===e.theme?"dark":"light";"dark"===t&&L("dark")})},50)}catch(t){let e=document.getElementById("designs-with-sales-list");e&&(e.innerHTML='<div style="text-align: center; color: #f44336; padding: 20px;">Error loading designs</div>')}}async function N(){try{let e=document.getElementById("summary-statistics-section");if(!e)return;let t=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllSales"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(!t||!t.success||!t.sales){e.innerHTML='<div style="padding: 20px; text-align: center; color: #999;">No sales data</div>';return}let o=t.sales,r=g(o),[i,l,a]=r.split("-").map(Number),n=new Date(i,l-1,a),s=new Date(n);s.setDate(s.getDate()-1);let d=`${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,"0")}-${String(s.getDate()).padStart(2,"0")}`,c=new Date(n);c.setDate(c.getDate()-6);let p=`${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,"0")}-${String(c.getDate()).padStart(2,"0")}`,h=new Date(n.getFullYear(),n.getMonth(),1),m=`${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}-${String(h.getDate()).padStart(2,"0")}`,u=new Date(n.getFullYear(),n.getMonth()-1,1),f=new Date(n.getFullYear(),n.getMonth(),0),b=`${u.getFullYear()}-${String(u.getMonth()+1).padStart(2,"0")}-${String(u.getDate()).padStart(2,"0")}`,v=`${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,"0")}-${String(f.getDate()).padStart(2,"0")}`,w=e=>{let t=e.reduce((e,t)=>e+(t.quantity||1),0),o=e.filter(e=>!e.isCancelled).reduce((e,t)=>e+(t.quantity||1),0),r=e.filter(e=>e.isCancelled).reduce((e,t)=>e+(t.quantity||1),0),i=e.filter(e=>!e.isCancelled).reduce((e,t)=>e+(t.netProfit||0),0),l=new Set(e.map(e=>e.workId)).size;return{quantity:t,sold:o,cancelled:r,royalties:i,uniqueProducts:l}},$=o.filter(e=>e.orderDate===d),S=o.filter(e=>e.orderDate>=p&&e.orderDate<=r),E=o.filter(e=>e.orderDate>=m&&e.orderDate<=r),C=o.filter(e=>e.orderDate>=b&&e.orderDate<=v),z=w($),T=w(S),M=w(E),I=w(C),j=w(o),q={quantity:0,sold:0,cancelled:0,royalties:0,uniqueProducts:0};try{let e=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(e&&e.success&&e.works){let t=e.works;q.quantity=t.reduce((e,t)=>e+(t.totalQuantity||0),0),q.royalties=t.reduce((e,t)=>e+(t.totalMargin||0),0),q.sold=0,q.cancelled=0,q.uniqueProducts=0}}catch(e){}let P=(e,t)=>{let o=new Date(e+"T12:00:00"),r=new Date(t+"T12:00:00"),i=o.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"}),l=r.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"});return`${i}-${l}`},A=null,U=null;o.forEach(e=>{e.orderDate&&((!A||e.orderDate<A)&&(A=e.orderDate),(!U||e.orderDate>U)&&(U=e.orderDate))});let _="All Time";if(A&&U){let e=e=>{let[t,o]=e.split("-"),r=parseInt(o)-1;return`${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][r]} ${t}`},t=e(A),o=e(U);_=t===o?t:`${t} - ${o}`}let F=[{period:`Yesterday ${(e=>{let t=new Date(e+"T12:00:00");return t.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"})})(d)}`,stats:z,periodType:"yesterday"},{period:`Last 7 Days ${P(p,r)}`,stats:T,periodType:"last7Days"},{period:`This Month ${P(m,r)}`,stats:M,periodType:"thisMonth"},{period:`Previous Month ${(e=>{let t=new Date(e+"T12:00:00");return t.toLocaleDateString("en-US",{month:"short",day:"numeric"})})(b)}`,stats:I,periodType:"previousMonth"},{period:_,stats:j,periodType:"allTime"},{period:"All Time",stats:q,periodType:"allTimeByWork"}],B=await D();e.innerHTML=F.map((e,t)=>{let{quantity:o,sold:r,cancelled:i,royalties:l,uniqueProducts:a}=e.stats,n=e.periodType,s="allTime"===n,d="allTimeByWork"===n;return`
        <div style="
          padding: 18px;
      display: flex;
          flex-direction: column;
          border-bottom: ${t<2?"1px solid #e0e0e0;":"none;"}
          ${s||d?"border-top: 1px solid #e0e0e0; padding-top: 18px;":""}
        ">
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 13px; color: #666; margin-right: 8px;">${e.period}</div>
            ${s?`<span class="summary-chart-icon" data-period="${n}" style="flex-shrink: 0; cursor: pointer; user-select: none; line-height: 1; margin-right: 6px; display: inline-flex; align-items: center;" title="View chart"><img src="${B}" style="width: 14px; height: 14px; object-fit: contain; opacity: 0.6; filter: grayscale(1) brightness(0.6);" alt="Chart"></span>`:""}
            ${d?`<span class="summary-menu-icon" data-period="${n}" style="flex-shrink: 0; color: #999; font-size: 16px; cursor: pointer; user-select: none; line-height: 1;" title="View by work">\u2630</span>`:""}
            ${d?"":`<span class="summary-menu-icon" data-period="${n}" style="flex-shrink: 0; color: #999; font-size: 16px; cursor: pointer; user-select: none; line-height: 1;" title="View sales">\u2630</span>`}
          </div>
          <div style="font-size: 42px; font-weight: bold; color: #333; margin-bottom: 8px; line-height: 1;">${o}</div>
          <div style="font-size: 12px; color: #666; line-height: 1.5;">
            <div>$${l.toFixed(2)}</div>
            ${d?"":`<div style="margin-top: 4px;">${r}-${i}</div>`}
          </div>
        </div>
      `}).join("");let H=e.__summaryClickHandler;H&&e.removeEventListener("click",H);let R=async e=>{let t=e.target,r=t.closest(".summary-menu-icon"),i=t.closest(".summary-chart-icon");if(r){e.stopPropagation(),e.preventDefault();let t=r.getAttribute("data-period");t&&("allTimeByWork"===t?await x():await y(t,o));return}if(i){e.stopPropagation(),e.preventDefault();let t=i.getAttribute("data-period");t&&await k(t,o);return}};e.addEventListener("click",R),e.__summaryClickHandler=R,setTimeout(async()=>{try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";"dark"===t&&L("dark")}catch(e){}},50)}catch(t){let e=document.getElementById("summary-statistics-section");e&&(e.innerHTML='<div style="padding: 20px; text-align: center; color: #999;">Error loading data</div>')}}async function O(){try{let e=document.getElementById("designs-with-sales-status-section");if(!e)return;let{withSales:t,totalLive:o}=await h(),r=o>0?Math.round(t/o*100):0,i=e.querySelector(".used"),l=e.querySelector(".limit"),a=e.querySelector(".progress-percent"),n=e.querySelector(".progress-bar");i&&(i.textContent=t.toString()),l&&(l.textContent=o.toString()),a&&(a.textContent=`(${r}%)`),n&&(n.style.width=`${Math.min(r,100)}%`,n.style.backgroundColor="#10b981")}catch(e){}}async function W(){try{let e=document.getElementById("live-designs-status-section");if(!e)return;let t=await m(),o=Math.round(t/30*1e3)/10,r=e.querySelector(".used"),i=e.querySelector(".limit"),l=e.querySelector(".progress-percent"),a=e.querySelector(".progress-bar");r&&(r.textContent=t.toString()),i&&(i.textContent="30"),l&&(l.textContent=`(${o.toFixed(1)}%)`),a&&(a.style.width=`${Math.min(o,100)}%`,o>=95?a.style.backgroundColor="rgb(244, 67, 54)":o>=80?a.style.backgroundColor="rgb(255, 152, 0)":a.style.backgroundColor="#10b981")}catch(e){}}async function Y(){try{let e=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllSales"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(!e||!e.success||!e.sales)return;let t=e.sales,o=g(t),r=t.filter(e=>e.orderDate===o),l=document.getElementById("today-sales-card"),a=document.getElementById("no-sales-card");if(!l||!a)return;let n=r.reduce((e,t)=>e+(t.quantity||1),0),s=r.filter(e=>!e.isCancelled).reduce((e,t)=>e+(t.artistMargin||0),0),d=await C(r),c=d.totalFees;l.style.display="",a.style.display="";let p=new Date(o+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}),h=l.querySelector('div[style*="padding: 12px 20px"]');h&&(h.innerHTML=`<div style="font-weight: 600; font-size: 15px; color: #333;">Today's Sales <span style="color: #999; font-weight: 400; font-size: 13px;">${p}</span></div>`);let m=document.getElementById("today-sales-content");if(m&&(m.style.cssText="text-align: center; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 230px;",m.innerHTML=`
        <div style="font-size: 120px; font-weight: bold; color: #10b981; margin-bottom: 12px; line-height: 1;">${n}</div>
        
        <div style="display: flex; justify-content: space-around; align-items: center; width: 100%; padding: 0 20px;">
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="font-size: 14px; font-weight: 500; color: #333; line-height: 1.2;">$${s.toFixed(2)}</div>
            <div style="font-size: 14px; font-weight: 400; color: #999; line-height: 1.2; margin-top: 2px;">Royalties</div>
        </div>
          
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="font-size: 14px; font-weight: 500; color: #333; line-height: 1.2;">$${c.toFixed(2)}</div>
            <div style="font-size: 14px; font-weight: 400; color: #999; line-height: 1.2; margin-top: 2px;">Fees</div>
      </div>
          
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="font-size: 14px; font-weight: 500; color: #333; line-height: 1.2;">$${(s-c).toFixed(2)}</div>
            <div style="font-size: 14px; font-weight: 400; color: #999; line-height: 1.2; margin-top: 2px;">Net Profit</div>
          </div>
        </div>
      `),r.length>0){let e=new Map;try{let t=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})});if(t&&t.success&&t.works){let o=t.works;o.forEach(t=>{e.set(t.workId,t)})}}catch(e){}a.style.overflow="hidden",a.style.maxWidth="100%",a.style.boxSizing="border-box",a.style.position="relative";let t=H("blur_switch_top_sales",!0),o=t.outerHTML;a.innerHTML=`
        <div style="font-weight: 600; margin-bottom: 10px; font-size: 15px; color: #333; padding: 0 8px; box-sizing: border-box; display: flex; align-items: center; gap: 8px;">Today's Top Sales${o}</div>
        <div style="max-height: 320px; overflow-y: auto; overflow-x: hidden; width: 100%; box-sizing: border-box; max-width: 100%;">
          ${r.slice(0,10).map(t=>{let o=e.get(t.workId),r=(0,i.getBunnyThumbnailUrl)(o?.imageUrl||o?.thumbnailUrl||""),l=o?.url||"",a=o?.editUrl||"";return`
              <div style="display: flex; align-items: center; gap: 12px; padding: 8px 8px; border-bottom: 1px solid #efefef; background-color: white; width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden;">
                
                <div style="text-align: center; min-width: 45px; flex-shrink: 0; max-width: 45px;">
                  <div style="font-size: 22px; font-weight: 700; color: #333; line-height: 1; margin-bottom: 2px;">${t.quantity}</div>
                  <div style="font-size: 10px; color: #888; font-weight: 400;">$${t.netProfit.toFixed(2)}</div>
                </div>
                
                <div class="hide-in-screenshot image-preview-container" data-image-url="${r}" style="width: 50px; height: 50px; min-width: 50px; flex-shrink: 0; background-color: #808080; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden; position: relative; cursor: pointer;">
                  ${r?`<img src="${r}" style="width: 100%; height: 100%; object-fit: cover;">`:'<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 20px; color: #ccc;">\uD83C\uDFA8</div>'}
                </div>
                
                <div style="flex: 1 1 0; min-width: 0; max-width: 100%; overflow: hidden; box-sizing: border-box;">
                  ${l?`
                    <a href="${l}" target="_blank" class="hide-in-screenshot" style="font-weight: 500; margin-bottom: 3px; font-size: 13px; color: #10b981; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; max-width: 100%; box-sizing: border-box; text-decoration: none; cursor: pointer; display: block;" title="${t.workTitle.replace(/"/g,"&quot;")}" onmouseover="this.style.textDecoration='underline';" onmouseout="this.style.textDecoration='none';">${t.workTitle}</a>
                  `:`
                    <div class="hide-in-screenshot" style="font-weight: 500; margin-bottom: 3px; font-size: 13px; color: #10b981; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; max-width: 100%; box-sizing: border-box;" title="${t.workTitle.replace(/"/g,"&quot;")}">${t.workTitle}</div>
                  `}
                  <div style="color: #999; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; box-sizing: border-box;">${t.product}</div>
                </div>
                
                ${a?`
                  <div style="flex-shrink: 0; min-width: 28px; max-width: 28px; margin-left: 4px;">
                    <a href="${a}" target="_blank" rel="noopener noreferrer" 
                       style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background-color: transparent; border: none; text-decoration: none; cursor: pointer; color: #f59e0b; opacity: 0.6; transition: opacity 0.2s; flex-shrink: 0;"
                       onmouseover="this.style.opacity='1'" 
                       onmouseout="this.style.opacity='0.6'"
                       title="Edit design">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354L11.427 2.487zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.25.25 0 00.108-.064l6.286-6.286z"/>
                      </svg>
                    </a>
                  </div>
                `:""}
              </div>
            `}).join("")}
        </div>
      `,a.style.display="",Z(a);let l=window.__applyScreenshotMode,n=window.__getSavedScreenshotMode;if(l&&n){let e=n();e&&l(e)}}}catch(e){}}function G(e){(0,l.injectLevelStyles)();let t=document.querySelector("header")||document.querySelector('[role="banner"]');t&&t.parentElement?t.parentElement.insertBefore(e,t.nextSibling):document.body.appendChild(e)}function V(){let e=document.getElementById("merchghost-dashboard-wrapper");e&&e.remove()}let Q=null,J=null;async function X(){try{let[e,t]=await Promise.all([new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllSales"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})})]);if(!e||!e.success||!e.sales)return;let o=e.sales,r={count:o.length,lastSaleId:o[0]?.saleId||""},i=t&&t.success&&t.works?t.works:[],a={count:i.length,lastWorkId:i[0]?.workId||""},n=!Q||Q.count!==r.count||Q.lastSaleId!==r.lastSaleId,d=!J||J.count!==a.count||J.lastWorkId!==a.lastWorkId;if(!n&&!d)return;Q=r,J=a;let p=await (0,l.getTotalSalesQuantity)(),g=await new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getMetadata",key:"initialSyncCompleted"},o=>{chrome.runtime.lastError?t(chrome.runtime.lastError):e(o)})}),h=g&&g.success&&"true"===g.value;h&&await (0,l.checkLevelUp)(p),function(e){let t=document.getElementById("level-card");if(!t)return;t.style.cssText=`
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 15px;
    background-color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  `;let o=(0,l.calculateLevel)(e),r=2*Math.PI*70,i=o.next?o.progress:100,a=o.current.image?chrome.runtime.getURL(`assets/level/${o.current.image}`):"";t.innerHTML=`
    <div style="text-align: center; width: 100%;">
      <div style="width: 150px; height: 150px; margin: 0 auto 8px; position: relative;">
        <svg width="150" height="150" style="transform: rotate(-90deg);">
          <circle cx="75" cy="75" r="70" fill="none" stroke="#e0e0e0" stroke-width="10"/>
          <circle cx="75" cy="75" r="70" fill="none" stroke="${o.current.color}" stroke-width="10" 
                  stroke-dasharray="${r}" stroke-dashoffset="${r-i/100*r}" stroke-linecap="round"/>
        </svg>
        ${a?`<img src="${a}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100px; height: 100px; object-fit: contain;">`:""}
      </div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 6px;">LEVEL: ${0===o.current.sales?"10":o.current.sales.toLocaleString()}</div>
      <div style="width: 100%; height: 8px; background-color: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
        <div style="width: ${i}%; height: 100%; background-color: ${o.current.color};"></div>
      </div>
      ${o.next?`
        <div style="font-size: 12px; color: #666;">
          ${o.salesRemaining.toLocaleString()} sales to Level ${o.next.sales.toLocaleString()}
        </div>
      `:`
        <div style="font-size: 12px; color: #FFD700; font-weight: 600;">
          \ud83c MAX LEVEL
        </div>
      `}
    </div>
  `}(p),await Y(),chrome.runtime.sendMessage({action:"updateBadge"},e=>{chrome.runtime.lastError||e&&e.success}),await W(),await O(),await c(),await R(),await N();let m=document.getElementById("sales-chart-canvas");m&&await u();let f=document.getElementById("designs-table-body");if(f){let e=document.getElementById("merchghost-content-container");e&&await s(e)}}catch(e){}}function Z(e){let t=document.getElementById("merchghost-image-preview-tooltip");t||((t=document.createElement("div")).id="merchghost-image-preview-tooltip",t.style.cssText=`
      position: fixed;
      display: none;
      z-index: 999999;
      pointer-events: none;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.8), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
      border: 2px solid #333;
      background: white;
      width: 300px;
      height: 300px;
      padding: 0;
      margin: 0;
      box-sizing: border-box;
    `,document.body.appendChild(t));let o=e.querySelectorAll(".image-preview-container"),r=null,i=null;o.forEach(e=>{let o=e.getAttribute("data-image-url");o&&o.trim()&&(e.addEventListener("mouseenter",l=>{i=e,r=setTimeout(()=>{if(i===e&&t){let r=e.getBoundingClientRect(),i=r.right+10,l=r.top;i+300>window.innerWidth&&(i=r.left-300-10),l+300>window.innerHeight&&(l=window.innerHeight-300-10),i<0&&(i=10),l<0&&(l=10),t.style.left=`${i}px`,t.style.top=`${l}px`,t.innerHTML=`<img src="${o}" style="width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; margin: 0; padding: 0;">`,t.style.display="block"}},300)}),e.addEventListener("mouseleave",()=>{i=null,r&&(clearTimeout(r),r=null),t&&(t.style.display="none")}),e.addEventListener("mousemove",o=>{if(i===e&&t&&"block"===t.style.display){e.getBoundingClientRect();let r=o.clientX+15,i=o.clientY-150;r+300>window.innerWidth&&(r=o.clientX-300-15),i+300>window.innerHeight&&(i=window.innerHeight-300-10),r<0&&(r=10),i<0&&(i=10),t.style.left=`${r}px`,t.style.top=`${i}px`}}))})}function K(){X(),setInterval(()=>{X()},1e4),chrome.runtime.onMessage.addListener((e,t,o)=>(("sales-updated"===e.type||"new-sale-added"===e.type)&&(X(),o({success:!0})),!0))}},{"../lib/utils":"3APgk","./level-system":"4lUfz","@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}],"3APgk":[function(e,t,o){var r=e("@parcel/transformer-js/src/esmodule-helpers.js");r.defineInteropFlag(o),r.export(o,"cn",()=>a),r.export(o,"THUMBNAIL_PLACEHOLDER_BG",()=>n),r.export(o,"getBunnyThumbnailUrl",()=>s);var i=e("clsx"),l=e("tailwind-merge");function a(...e){return(0,l.twMerge)((0,i.clsx)(e))}let n="bg-[#808080]";function s(e){if(!e||"string"!=typeof e)return"";if(e.startsWith("data:")||e.startsWith("blob:"))return e;let t=e.includes("?")?"&":"?";return`${e}${t}class=preview02`}},{clsx:"7x4s2","tailwind-merge":"asOaB","@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}],"7x4s2":[function(e,t,o){var r=e("@parcel/transformer-js/src/esmodule-helpers.js");function i(){for(var e,t,o=0,r="",i=arguments.length;o<i;o++)(e=arguments[o])&&(t=function e(t){var o,r,i="";if("string"==typeof t||"number"==typeof t)i+=t;else if("object"==typeof t){if(Array.isArray(t)){var l=t.length;for(o=0;o<l;o++)t[o]&&(r=e(t[o]))&&(i&&(i+=" "),i+=r)}else for(r in t)t[r]&&(i&&(i+=" "),i+=r)}return i}(e))&&(r&&(r+=" "),r+=t);return r}r.defineInteropFlag(o),r.export(o,"clsx",()=>i),o.default=i},{"@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}],fRZO2:[function(e,t,o){o.interopDefault=function(e){return e&&e.__esModule?e:{default:e}},o.defineInteropFlag=function(e){Object.defineProperty(e,"__esModule",{value:!0})},o.exportAll=function(e,t){return Object.keys(e).forEach(function(o){"default"===o||"__esModule"===o||t.hasOwnProperty(o)||Object.defineProperty(t,o,{enumerable:!0,get:function(){return e[o]}})}),t},o.export=function(e,t,o){Object.defineProperty(e,t,{enumerable:!0,get:o})}},{}],asOaB:[function(e,t,o){Object.defineProperty(o,Symbol.toStringTag,{value:"Module"});let r=e=>{let t=n(e),{conflictingClassGroups:o,conflictingClassGroupModifiers:r}=e;return{getClassGroupId:e=>{let o=e.split("-");return""===o[0]&&1!==o.length&&o.shift(),i(o,t)||a(e)},getConflictingClassGroupIds:(e,t)=>{let i=o[e]||[];return t&&r[e]?[...i,...r[e]]:i}}},i=(e,t)=>{if(0===e.length)return t.classGroupId;let o=e[0],r=t.nextPart.get(o),l=r?i(e.slice(1),r):void 0;if(l)return l;if(0===t.validators.length)return;let a=e.join("-");return t.validators.find(({validator:e})=>e(a))?.classGroupId},l=/^\[(.+)\]$/,a=e=>{if(l.test(e)){let t=l.exec(e)[1],o=t?.substring(0,t.indexOf(":"));if(o)return"arbitrary.."+o}},n=e=>{let{theme:t,prefix:o}=e,r={nextPart:new Map,validators:[]},i=p(Object.entries(e.classGroups),o);return i.forEach(([e,o])=>{s(o,r,e,t)}),r},s=(e,t,o,r)=>{e.forEach(e=>{if("string"==typeof e){let r=""===e?t:d(t,e);r.classGroupId=o;return}if("function"==typeof e){if(c(e)){s(e(r),t,o,r);return}t.validators.push({validator:e,classGroupId:o});return}Object.entries(e).forEach(([e,i])=>{s(i,d(t,e),o,r)})})},d=(e,t)=>{let o=e;return t.split("-").forEach(e=>{o.nextPart.has(e)||o.nextPart.set(e,{nextPart:new Map,validators:[]}),o=o.nextPart.get(e)}),o},c=e=>e.isThemeGetter,p=(e,t)=>t?e.map(([e,o])=>{let r=o.map(e=>"string"==typeof e?t+e:"object"==typeof e?Object.fromEntries(Object.entries(e).map(([e,o])=>[t+e,o])):e);return[e,r]}):e,g=e=>{if(e<1)return{get:()=>void 0,set:()=>{}};let t=0,o=new Map,r=new Map,i=(i,l)=>{o.set(i,l),++t>e&&(t=0,r=o,o=new Map)};return{get(e){let t=o.get(e);return void 0!==t?t:void 0!==(t=r.get(e))?(i(e,t),t):void 0},set(e,t){o.has(e)?o.set(e,t):i(e,t)}}},h=e=>{let{separator:t,experimentalParseClassName:o}=e,r=1===t.length,i=t[0],l=t.length,a=e=>{let o;let a=[],n=0,s=0;for(let d=0;d<e.length;d++){let c=e[d];if(0===n){if(c===i&&(r||e.slice(d,d+l)===t)){a.push(e.slice(s,d)),s=d+l;continue}if("/"===c){o=d;continue}}"["===c?n++:"]"===c&&n--}let d=0===a.length?e:e.substring(s),c=d.startsWith("!"),p=c?d.substring(1):d,g=o&&o>s?o-s:void 0;return{modifiers:a,hasImportantModifier:c,baseClassName:p,maybePostfixModifierPosition:g}};return o?e=>o({className:e,parseClassName:a}):a},m=e=>{if(e.length<=1)return e;let t=[],o=[];return e.forEach(e=>{let r="["===e[0];r?(t.push(...o.sort(),e),o=[]):o.push(e)}),t.push(...o.sort()),t},u=e=>({cache:g(e.cacheSize),parseClassName:h(e),...r(e)}),f=/\s+/,b=(e,t)=>{let{parseClassName:o,getClassGroupId:r,getConflictingClassGroupIds:i}=t,l=[],a=e.trim().split(f),n="";for(let e=a.length-1;e>=0;e-=1){let t=a[e],{modifiers:s,hasImportantModifier:d,baseClassName:c,maybePostfixModifierPosition:p}=o(t),g=!!p,h=r(g?c.substring(0,p):c);if(!h){if(!g||!(h=r(c))){n=t+(n.length>0?" "+n:n);continue}g=!1}let u=m(s).join(":"),f=d?u+"!":u,b=f+h;if(l.includes(b))continue;l.push(b);let x=i(h,g);for(let e=0;e<x.length;++e){let t=x[e];l.push(f+t)}n=t+(n.length>0?" "+n:n)}return n};function x(){let e,t,o=0,r="";for(;o<arguments.length;)(e=arguments[o++])&&(t=y(e))&&(r&&(r+=" "),r+=t);return r}let y=e=>{let t;if("string"==typeof e)return e;let o="";for(let r=0;r<e.length;r++)e[r]&&(t=y(e[r]))&&(o&&(o+=" "),o+=t);return o};function v(e,...t){let o,r,i;let l=function(n){let s=t.reduce((e,t)=>t(e),e());return r=(o=u(s)).cache.get,i=o.cache.set,l=a,a(n)};function a(e){let t=r(e);if(t)return t;let l=b(e,o);return i(e,l),l}return function(){return l(x.apply(null,arguments))}}let w=e=>{let t=t=>t[e]||[];return t.isThemeGetter=!0,t},k=/^\[(?:([a-z-]+):)?(.+)\]$/i,$=/^\d+\/\d+$/,S=new Set(["px","full","screen"]),E=/^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,C=/\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,z=/^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/,L=/^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,T=/^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,M=e=>I(e)||S.has(e)||$.test(e),D=e=>W(e,"length",Y),I=e=>!!e&&!Number.isNaN(Number(e)),j=e=>W(e,"number",I),q=e=>!!e&&Number.isInteger(Number(e)),P=e=>e.endsWith("%")&&I(e.slice(0,-1)),A=e=>k.test(e),U=e=>E.test(e),_=new Set(["length","size","percentage"]),F=e=>W(e,_,G),B=e=>W(e,"position",G),H=new Set(["image","url"]),R=e=>W(e,H,Q),N=e=>W(e,"",V),O=()=>!0,W=(e,t,o)=>{let r=k.exec(e);return!!r&&(r[1]?"string"==typeof t?r[1]===t:t.has(r[1]):o(r[2]))},Y=e=>C.test(e)&&!z.test(e),G=()=>!1,V=e=>L.test(e),Q=e=>T.test(e),J=Object.defineProperty({__proto__:null,isAny:O,isArbitraryImage:R,isArbitraryLength:D,isArbitraryNumber:j,isArbitraryPosition:B,isArbitraryShadow:N,isArbitrarySize:F,isArbitraryValue:A,isInteger:q,isLength:M,isNumber:I,isPercent:P,isTshirtSize:U},Symbol.toStringTag,{value:"Module"}),X=()=>{let e=w("colors"),t=w("spacing"),o=w("blur"),r=w("brightness"),i=w("borderColor"),l=w("borderRadius"),a=w("borderSpacing"),n=w("borderWidth"),s=w("contrast"),d=w("grayscale"),c=w("hueRotate"),p=w("invert"),g=w("gap"),h=w("gradientColorStops"),m=w("gradientColorStopPositions"),u=w("inset"),f=w("margin"),b=w("opacity"),x=w("padding"),y=w("saturate"),v=w("scale"),k=w("sepia"),$=w("skew"),S=w("space"),E=w("translate"),C=()=>["auto","contain","none"],z=()=>["auto","hidden","clip","visible","scroll"],L=()=>["auto",A,t],T=()=>[A,t],_=()=>["",M,D],H=()=>["auto",I,A],W=()=>["bottom","center","left","left-bottom","left-top","right","right-bottom","right-top","top"],Y=()=>["solid","dashed","dotted","double","none"],G=()=>["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity"],V=()=>["start","end","center","between","around","evenly","stretch"],Q=()=>["","0",A],J=()=>["auto","avoid","all","avoid-page","page","left","right","column"],X=()=>[I,A];return{cacheSize:500,separator:":",theme:{colors:[O],spacing:[M,D],blur:["none","",U,A],brightness:X(),borderColor:[e],borderRadius:["none","","full",U,A],borderSpacing:T(),borderWidth:_(),contrast:X(),grayscale:Q(),hueRotate:X(),invert:Q(),gap:T(),gradientColorStops:[e],gradientColorStopPositions:[P,D],inset:L(),margin:L(),opacity:X(),padding:T(),saturate:X(),scale:X(),sepia:Q(),skew:X(),space:T(),translate:T()},classGroups:{aspect:[{aspect:["auto","square","video",A]}],container:["container"],columns:[{columns:[U]}],"break-after":[{"break-after":J()}],"break-before":[{"break-before":J()}],"break-inside":[{"break-inside":["auto","avoid","avoid-page","avoid-column"]}],"box-decoration":[{"box-decoration":["slice","clone"]}],box:[{box:["border","content"]}],display:["block","inline-block","inline","flex","inline-flex","table","inline-table","table-caption","table-cell","table-column","table-column-group","table-footer-group","table-header-group","table-row-group","table-row","flow-root","grid","inline-grid","contents","list-item","hidden"],float:[{float:["right","left","none","start","end"]}],clear:[{clear:["left","right","both","none","start","end"]}],isolation:["isolate","isolation-auto"],"object-fit":[{object:["contain","cover","fill","none","scale-down"]}],"object-position":[{object:[...W(),A]}],overflow:[{overflow:z()}],"overflow-x":[{"overflow-x":z()}],"overflow-y":[{"overflow-y":z()}],overscroll:[{overscroll:C()}],"overscroll-x":[{"overscroll-x":C()}],"overscroll-y":[{"overscroll-y":C()}],position:["static","fixed","absolute","relative","sticky"],inset:[{inset:[u]}],"inset-x":[{"inset-x":[u]}],"inset-y":[{"inset-y":[u]}],start:[{start:[u]}],end:[{end:[u]}],top:[{top:[u]}],right:[{right:[u]}],bottom:[{bottom:[u]}],left:[{left:[u]}],visibility:["visible","invisible","collapse"],z:[{z:["auto",q,A]}],basis:[{basis:L()}],"flex-direction":[{flex:["row","row-reverse","col","col-reverse"]}],"flex-wrap":[{flex:["wrap","wrap-reverse","nowrap"]}],flex:[{flex:["1","auto","initial","none",A]}],grow:[{grow:Q()}],shrink:[{shrink:Q()}],order:[{order:["first","last","none",q,A]}],"grid-cols":[{"grid-cols":[O]}],"col-start-end":[{col:["auto",{span:["full",q,A]},A]}],"col-start":[{"col-start":H()}],"col-end":[{"col-end":H()}],"grid-rows":[{"grid-rows":[O]}],"row-start-end":[{row:["auto",{span:[q,A]},A]}],"row-start":[{"row-start":H()}],"row-end":[{"row-end":H()}],"grid-flow":[{"grid-flow":["row","col","dense","row-dense","col-dense"]}],"auto-cols":[{"auto-cols":["auto","min","max","fr",A]}],"auto-rows":[{"auto-rows":["auto","min","max","fr",A]}],gap:[{gap:[g]}],"gap-x":[{"gap-x":[g]}],"gap-y":[{"gap-y":[g]}],"justify-content":[{justify:["normal",...V()]}],"justify-items":[{"justify-items":["start","end","center","stretch"]}],"justify-self":[{"justify-self":["auto","start","end","center","stretch"]}],"align-content":[{content:["normal",...V(),"baseline"]}],"align-items":[{items:["start","end","center","baseline","stretch"]}],"align-self":[{self:["auto","start","end","center","stretch","baseline"]}],"place-content":[{"place-content":[...V(),"baseline"]}],"place-items":[{"place-items":["start","end","center","baseline","stretch"]}],"place-self":[{"place-self":["auto","start","end","center","stretch"]}],p:[{p:[x]}],px:[{px:[x]}],py:[{py:[x]}],ps:[{ps:[x]}],pe:[{pe:[x]}],pt:[{pt:[x]}],pr:[{pr:[x]}],pb:[{pb:[x]}],pl:[{pl:[x]}],m:[{m:[f]}],mx:[{mx:[f]}],my:[{my:[f]}],ms:[{ms:[f]}],me:[{me:[f]}],mt:[{mt:[f]}],mr:[{mr:[f]}],mb:[{mb:[f]}],ml:[{ml:[f]}],"space-x":[{"space-x":[S]}],"space-x-reverse":["space-x-reverse"],"space-y":[{"space-y":[S]}],"space-y-reverse":["space-y-reverse"],w:[{w:["auto","min","max","fit","svw","lvw","dvw",A,t]}],"min-w":[{"min-w":[A,t,"min","max","fit"]}],"max-w":[{"max-w":[A,t,"none","full","min","max","fit","prose",{screen:[U]},U]}],h:[{h:[A,t,"auto","min","max","fit","svh","lvh","dvh"]}],"min-h":[{"min-h":[A,t,"min","max","fit","svh","lvh","dvh"]}],"max-h":[{"max-h":[A,t,"min","max","fit","svh","lvh","dvh"]}],size:[{size:[A,t,"auto","min","max","fit"]}],"font-size":[{text:["base",U,D]}],"font-smoothing":["antialiased","subpixel-antialiased"],"font-style":["italic","not-italic"],"font-weight":[{font:["thin","extralight","light","normal","medium","semibold","bold","extrabold","black",j]}],"font-family":[{font:[O]}],"fvn-normal":["normal-nums"],"fvn-ordinal":["ordinal"],"fvn-slashed-zero":["slashed-zero"],"fvn-figure":["lining-nums","oldstyle-nums"],"fvn-spacing":["proportional-nums","tabular-nums"],"fvn-fraction":["diagonal-fractions","stacked-fractions"],tracking:[{tracking:["tighter","tight","normal","wide","wider","widest",A]}],"line-clamp":[{"line-clamp":["none",I,j]}],leading:[{leading:["none","tight","snug","normal","relaxed","loose",M,A]}],"list-image":[{"list-image":["none",A]}],"list-style-type":[{list:["none","disc","decimal",A]}],"list-style-position":[{list:["inside","outside"]}],"placeholder-color":[{placeholder:[e]}],"placeholder-opacity":[{"placeholder-opacity":[b]}],"text-alignment":[{text:["left","center","right","justify","start","end"]}],"text-color":[{text:[e]}],"text-opacity":[{"text-opacity":[b]}],"text-decoration":["underline","overline","line-through","no-underline"],"text-decoration-style":[{decoration:[...Y(),"wavy"]}],"text-decoration-thickness":[{decoration:["auto","from-font",M,D]}],"underline-offset":[{"underline-offset":["auto",M,A]}],"text-decoration-color":[{decoration:[e]}],"text-transform":["uppercase","lowercase","capitalize","normal-case"],"text-overflow":["truncate","text-ellipsis","text-clip"],"text-wrap":[{text:["wrap","nowrap","balance","pretty"]}],indent:[{indent:T()}],"vertical-align":[{align:["baseline","top","middle","bottom","text-top","text-bottom","sub","super",A]}],whitespace:[{whitespace:["normal","nowrap","pre","pre-line","pre-wrap","break-spaces"]}],break:[{break:["normal","words","all","keep"]}],hyphens:[{hyphens:["none","manual","auto"]}],content:[{content:["none",A]}],"bg-attachment":[{bg:["fixed","local","scroll"]}],"bg-clip":[{"bg-clip":["border","padding","content","text"]}],"bg-opacity":[{"bg-opacity":[b]}],"bg-origin":[{"bg-origin":["border","padding","content"]}],"bg-position":[{bg:[...W(),B]}],"bg-repeat":[{bg:["no-repeat",{repeat:["","x","y","round","space"]}]}],"bg-size":[{bg:["auto","cover","contain",F]}],"bg-image":[{bg:["none",{"gradient-to":["t","tr","r","br","b","bl","l","tl"]},R]}],"bg-color":[{bg:[e]}],"gradient-from-pos":[{from:[m]}],"gradient-via-pos":[{via:[m]}],"gradient-to-pos":[{to:[m]}],"gradient-from":[{from:[h]}],"gradient-via":[{via:[h]}],"gradient-to":[{to:[h]}],rounded:[{rounded:[l]}],"rounded-s":[{"rounded-s":[l]}],"rounded-e":[{"rounded-e":[l]}],"rounded-t":[{"rounded-t":[l]}],"rounded-r":[{"rounded-r":[l]}],"rounded-b":[{"rounded-b":[l]}],"rounded-l":[{"rounded-l":[l]}],"rounded-ss":[{"rounded-ss":[l]}],"rounded-se":[{"rounded-se":[l]}],"rounded-ee":[{"rounded-ee":[l]}],"rounded-es":[{"rounded-es":[l]}],"rounded-tl":[{"rounded-tl":[l]}],"rounded-tr":[{"rounded-tr":[l]}],"rounded-br":[{"rounded-br":[l]}],"rounded-bl":[{"rounded-bl":[l]}],"border-w":[{border:[n]}],"border-w-x":[{"border-x":[n]}],"border-w-y":[{"border-y":[n]}],"border-w-s":[{"border-s":[n]}],"border-w-e":[{"border-e":[n]}],"border-w-t":[{"border-t":[n]}],"border-w-r":[{"border-r":[n]}],"border-w-b":[{"border-b":[n]}],"border-w-l":[{"border-l":[n]}],"border-opacity":[{"border-opacity":[b]}],"border-style":[{border:[...Y(),"hidden"]}],"divide-x":[{"divide-x":[n]}],"divide-x-reverse":["divide-x-reverse"],"divide-y":[{"divide-y":[n]}],"divide-y-reverse":["divide-y-reverse"],"divide-opacity":[{"divide-opacity":[b]}],"divide-style":[{divide:Y()}],"border-color":[{border:[i]}],"border-color-x":[{"border-x":[i]}],"border-color-y":[{"border-y":[i]}],"border-color-s":[{"border-s":[i]}],"border-color-e":[{"border-e":[i]}],"border-color-t":[{"border-t":[i]}],"border-color-r":[{"border-r":[i]}],"border-color-b":[{"border-b":[i]}],"border-color-l":[{"border-l":[i]}],"divide-color":[{divide:[i]}],"outline-style":[{outline:["",...Y()]}],"outline-offset":[{"outline-offset":[M,A]}],"outline-w":[{outline:[M,D]}],"outline-color":[{outline:[e]}],"ring-w":[{ring:_()}],"ring-w-inset":["ring-inset"],"ring-color":[{ring:[e]}],"ring-opacity":[{"ring-opacity":[b]}],"ring-offset-w":[{"ring-offset":[M,D]}],"ring-offset-color":[{"ring-offset":[e]}],shadow:[{shadow:["","inner","none",U,N]}],"shadow-color":[{shadow:[O]}],opacity:[{opacity:[b]}],"mix-blend":[{"mix-blend":[...G(),"plus-lighter","plus-darker"]}],"bg-blend":[{"bg-blend":G()}],filter:[{filter:["","none"]}],blur:[{blur:[o]}],brightness:[{brightness:[r]}],contrast:[{contrast:[s]}],"drop-shadow":[{"drop-shadow":["","none",U,A]}],grayscale:[{grayscale:[d]}],"hue-rotate":[{"hue-rotate":[c]}],invert:[{invert:[p]}],saturate:[{saturate:[y]}],sepia:[{sepia:[k]}],"backdrop-filter":[{"backdrop-filter":["","none"]}],"backdrop-blur":[{"backdrop-blur":[o]}],"backdrop-brightness":[{"backdrop-brightness":[r]}],"backdrop-contrast":[{"backdrop-contrast":[s]}],"backdrop-grayscale":[{"backdrop-grayscale":[d]}],"backdrop-hue-rotate":[{"backdrop-hue-rotate":[c]}],"backdrop-invert":[{"backdrop-invert":[p]}],"backdrop-opacity":[{"backdrop-opacity":[b]}],"backdrop-saturate":[{"backdrop-saturate":[y]}],"backdrop-sepia":[{"backdrop-sepia":[k]}],"border-collapse":[{border:["collapse","separate"]}],"border-spacing":[{"border-spacing":[a]}],"border-spacing-x":[{"border-spacing-x":[a]}],"border-spacing-y":[{"border-spacing-y":[a]}],"table-layout":[{table:["auto","fixed"]}],caption:[{caption:["top","bottom"]}],transition:[{transition:["none","all","","colors","opacity","shadow","transform",A]}],duration:[{duration:X()}],ease:[{ease:["linear","in","out","in-out",A]}],delay:[{delay:X()}],animate:[{animate:["none","spin","ping","pulse","bounce",A]}],transform:[{transform:["","gpu","none"]}],scale:[{scale:[v]}],"scale-x":[{"scale-x":[v]}],"scale-y":[{"scale-y":[v]}],rotate:[{rotate:[q,A]}],"translate-x":[{"translate-x":[E]}],"translate-y":[{"translate-y":[E]}],"skew-x":[{"skew-x":[$]}],"skew-y":[{"skew-y":[$]}],"transform-origin":[{origin:["center","top","top-right","right","bottom-right","bottom","bottom-left","left","top-left",A]}],accent:[{accent:["auto",e]}],appearance:[{appearance:["none","auto"]}],cursor:[{cursor:["auto","default","pointer","wait","text","move","help","not-allowed","none","context-menu","progress","cell","crosshair","vertical-text","alias","copy","no-drop","grab","grabbing","all-scroll","col-resize","row-resize","n-resize","e-resize","s-resize","w-resize","ne-resize","nw-resize","se-resize","sw-resize","ew-resize","ns-resize","nesw-resize","nwse-resize","zoom-in","zoom-out",A]}],"caret-color":[{caret:[e]}],"pointer-events":[{"pointer-events":["none","auto"]}],resize:[{resize:["none","y","x",""]}],"scroll-behavior":[{scroll:["auto","smooth"]}],"scroll-m":[{"scroll-m":T()}],"scroll-mx":[{"scroll-mx":T()}],"scroll-my":[{"scroll-my":T()}],"scroll-ms":[{"scroll-ms":T()}],"scroll-me":[{"scroll-me":T()}],"scroll-mt":[{"scroll-mt":T()}],"scroll-mr":[{"scroll-mr":T()}],"scroll-mb":[{"scroll-mb":T()}],"scroll-ml":[{"scroll-ml":T()}],"scroll-p":[{"scroll-p":T()}],"scroll-px":[{"scroll-px":T()}],"scroll-py":[{"scroll-py":T()}],"scroll-ps":[{"scroll-ps":T()}],"scroll-pe":[{"scroll-pe":T()}],"scroll-pt":[{"scroll-pt":T()}],"scroll-pr":[{"scroll-pr":T()}],"scroll-pb":[{"scroll-pb":T()}],"scroll-pl":[{"scroll-pl":T()}],"snap-align":[{snap:["start","end","center","align-none"]}],"snap-stop":[{snap:["normal","always"]}],"snap-type":[{snap:["none","x","y","both"]}],"snap-strictness":[{snap:["mandatory","proximity"]}],touch:[{touch:["auto","none","manipulation"]}],"touch-x":[{"touch-pan":["x","left","right"]}],"touch-y":[{"touch-pan":["y","up","down"]}],"touch-pz":["touch-pinch-zoom"],select:[{select:["none","text","all","auto"]}],"will-change":[{"will-change":["auto","scroll","contents","transform",A]}],fill:[{fill:[e,"none"]}],"stroke-w":[{stroke:[M,D,j]}],stroke:[{stroke:[e,"none"]}],sr:["sr-only","not-sr-only"],"forced-color-adjust":[{"forced-color-adjust":["auto","none"]}]},conflictingClassGroups:{overflow:["overflow-x","overflow-y"],overscroll:["overscroll-x","overscroll-y"],inset:["inset-x","inset-y","start","end","top","right","bottom","left"],"inset-x":["right","left"],"inset-y":["top","bottom"],flex:["basis","grow","shrink"],gap:["gap-x","gap-y"],p:["px","py","ps","pe","pt","pr","pb","pl"],px:["pr","pl"],py:["pt","pb"],m:["mx","my","ms","me","mt","mr","mb","ml"],mx:["mr","ml"],my:["mt","mb"],size:["w","h"],"font-size":["leading"],"fvn-normal":["fvn-ordinal","fvn-slashed-zero","fvn-figure","fvn-spacing","fvn-fraction"],"fvn-ordinal":["fvn-normal"],"fvn-slashed-zero":["fvn-normal"],"fvn-figure":["fvn-normal"],"fvn-spacing":["fvn-normal"],"fvn-fraction":["fvn-normal"],"line-clamp":["display","overflow"],rounded:["rounded-s","rounded-e","rounded-t","rounded-r","rounded-b","rounded-l","rounded-ss","rounded-se","rounded-ee","rounded-es","rounded-tl","rounded-tr","rounded-br","rounded-bl"],"rounded-s":["rounded-ss","rounded-es"],"rounded-e":["rounded-se","rounded-ee"],"rounded-t":["rounded-tl","rounded-tr"],"rounded-r":["rounded-tr","rounded-br"],"rounded-b":["rounded-br","rounded-bl"],"rounded-l":["rounded-tl","rounded-bl"],"border-spacing":["border-spacing-x","border-spacing-y"],"border-w":["border-w-s","border-w-e","border-w-t","border-w-r","border-w-b","border-w-l"],"border-w-x":["border-w-r","border-w-l"],"border-w-y":["border-w-t","border-w-b"],"border-color":["border-color-s","border-color-e","border-color-t","border-color-r","border-color-b","border-color-l"],"border-color-x":["border-color-r","border-color-l"],"border-color-y":["border-color-t","border-color-b"],"scroll-m":["scroll-mx","scroll-my","scroll-ms","scroll-me","scroll-mt","scroll-mr","scroll-mb","scroll-ml"],"scroll-mx":["scroll-mr","scroll-ml"],"scroll-my":["scroll-mt","scroll-mb"],"scroll-p":["scroll-px","scroll-py","scroll-ps","scroll-pe","scroll-pt","scroll-pr","scroll-pb","scroll-pl"],"scroll-px":["scroll-pr","scroll-pl"],"scroll-py":["scroll-pt","scroll-pb"],touch:["touch-x","touch-y","touch-pz"],"touch-x":["touch"],"touch-y":["touch"],"touch-pz":["touch"]},conflictingClassGroupModifiers:{"font-size":["leading"]}}},Z=(e,{cacheSize:t,prefix:o,separator:r,experimentalParseClassName:i,extend:l={},override:a={}})=>{for(let l in K(e,"cacheSize",t),K(e,"prefix",o),K(e,"separator",r),K(e,"experimentalParseClassName",i),a)ee(e[l],a[l]);for(let t in l)et(e[t],l[t]);return e},K=(e,t,o)=>{void 0!==o&&(e[t]=o)},ee=(e,t)=>{if(t)for(let o in t)K(e,o,t[o])},et=(e,t)=>{if(t)for(let o in t){let r=t[o];void 0!==r&&(e[o]=(e[o]||[]).concat(r))}},eo=v(X);o.createTailwindMerge=v,o.extendTailwindMerge=(e,...t)=>"function"==typeof e?v(X,e,...t):v(()=>Z(X(),e),...t),o.fromTheme=w,o.getDefaultConfig=X,o.mergeConfigs=Z,o.twJoin=x,o.twMerge=eo,o.validators=J},{}],"4lUfz":[function(e,t,o){var r=e("@parcel/transformer-js/src/esmodule-helpers.js");r.defineInteropFlag(o),r.export(o,"calculateLevel",()=>a),r.export(o,"getTotalSalesQuantity",()=>n),r.export(o,"createLevelBadge",()=>s),r.export(o,"createLevelUpModal",()=>d),r.export(o,"playLevelUpSound",()=>c),r.export(o,"checkLevelUp",()=>g),r.export(o,"showLevelUpModal",()=>h),r.export(o,"injectLevelStyles",()=>m);let i="#10b981",l=[{sales:5e4,image:"50000.png",name:"Legendary Master",color:i},{sales:2e4,image:"20000.png",name:"Elite Pro",color:i},{sales:15e3,image:"15000.png",name:"Master Pro",color:i},{sales:1e4,image:"10000.png",name:"Pro",color:i},{sales:8e3,image:"8000.png",name:"Expert IV",color:i},{sales:7e3,image:"7000.png",name:"Expert III",color:i},{sales:5e3,image:"5000.png",name:"Expert II",color:i},{sales:4e3,image:"4000.png",name:"Expert I",color:i},{sales:3e3,image:"3000.png",name:"Advanced IV",color:i},{sales:2200,image:"2200.png",name:"Advanced III",color:i},{sales:1800,image:"1800.png",name:"Advanced II",color:i},{sales:1400,image:"1400.png",name:"Advanced I",color:i},{sales:1e3,image:"1000.png",name:"Intermediate IV",color:i},{sales:800,image:"800.png",name:"Intermediate III",color:i},{sales:500,image:"500.png",name:"Intermediate II",color:i},{sales:300,image:"300.png",name:"Intermediate I",color:i},{sales:200,image:"200.png",name:"Beginner V",color:i},{sales:150,image:"150.png",name:"Beginner IV",color:i},{sales:100,image:"100.png",name:"Beginner III",color:i},{sales:30,image:"30.png",name:"Beginner II",color:i},{sales:10,image:"10.png",name:"Beginner I",color:i}];function a(e){let t=l[l.length-1],o=l.length>1?l[l.length-2]:null;for(let r=0;r<l.length;r++){let i=l[r],a=r<l.length-1?l[r+1].sales:0;if(e>=a&&e<=i.sales){t=i,o=r>0?l[r-1]:null;break}}e>l[0].sales&&(t=l[0],o=null);let r=0,i=0,a=0,n=0;return o?(r=(e-(a=10===t.sales?0:l.findIndex(e=>e.sales===t.sales)<l.length-1?l[l.findIndex(e=>e.sales===t.sales)+1].sales:0))/(t.sales-a)*100,n=t.sales-e):(r=100,n=0),{current:t,next:o,totalSales:e,progress:Math.min(Math.max(r,0),100),salesRemaining:n}}async function n(){return new Promise((e,t)=>{chrome.runtime.sendMessage({action:"getAllWorks"},o=>{if(chrome.runtime.lastError){t(chrome.runtime.lastError);return}let r=o?.works||[],i=r.reduce((e,t)=>e+(t.totalQuantity||0),0);e(i)})})}function s(e){let t=document.createElement("div");t.className="merchghost-level-badge",t.style.setProperty("--level-color",e.current.color);let o=e.current.image?chrome.runtime.getURL(`assets/level/${e.current.image}`):"";return t.innerHTML=`
    <div class="level-display-compact">
      <div class="level-circle-container">
        ${function(e,t){let o=2*Math.PI*85;return`
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
        stroke-dasharray="${o}"
        stroke-dashoffset="${o-e/100*o}"
        stroke-linecap="round"
        transform="rotate(-90 100 100)"
        class="level-progress-circle-animate"
      />
    </svg>
  `}(e.next?e.progress:100,e.current.color)}
        ${o?`<img src="${o}" class="level-icon-compact" alt="Level ${e.current.sales}">`:""}
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
  `,t}async function d(e){let t=document.createElement("div");t.id="merchghost-level-up-modal",t.className="merchghost-level-up-modal";let o=chrome.runtime.getURL("assets/big-red-button.png"),r=chrome.runtime.getURL("assets/hand-cursor.png"),i=chrome.runtime.getURL("assets/Lightogo-footer@2x.png");try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";i="dark"===t?chrome.runtime.getURL("assets/Darklogo-footer@2x.png"):chrome.runtime.getURL("assets/Lightogo-footer@2x.png")}catch(e){}t.innerHTML=`
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
          <img src="${o}" class="red-button" alt="Reveal New Tier">
          <img src="${r}" class="hand-cursor" alt="Click">
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
        <img src="${i}" alt="MerchGhost" class="level-modal-logo">
      </div>
    </div>
  `;let l=t.querySelector("#level-modal-close-btn"),a=t.querySelector(".red-button-container"),n=t.querySelector(".hand-cursor"),s=t.querySelector(".level-stage-1"),d=t.querySelector(".level-stage-2"),p=t.querySelector(".level-stage-3"),g=t.querySelector(".counter-display"),h=t.querySelector(".level-icon-final-container");return l?.addEventListener("click",()=>{t.remove()}),l?.addEventListener("mouseover",()=>{l.style.background="#e5e7eb"}),l?.addEventListener("mouseout",()=>{l.style.background="#f3f4f6"}),a?.addEventListener("mousemove",e=>{let t=a.getBoundingClientRect(),o=e.clientX-t.left,r=e.clientY-t.top;n&&(n.style.left=`${o}px`,n.style.top=`${r}px`,n.style.transform="translate(-50%, -50%)")}),a?.addEventListener("mouseleave",()=>{n&&(n.style.left="",n.style.top="",n.style.transform="")}),a?.addEventListener("click",()=>{s.style.display="none",d.style.display="flex";let o=e.current.sales,r=o/60,i=0,l=setInterval(()=>{(i+=r)>=o&&(i=o,clearInterval(l),setTimeout(()=>{d.style.display="none",p.style.display="flex";let o=e.current.image?chrome.runtime.getURL(`assets/level/${e.current.image}`):"";o&&(h.innerHTML=`<img src="${o}" class="level-icon-final" alt="Level ${e.current.sales}">`);let r=t.querySelector(".level-modal-content-new");r&&setTimeout(()=>{(function(e){let t=chrome.runtime.getURL("assets/celebration.gif"),o=e.querySelector("#celebration-gif");o&&o.remove();let r=document.createElement("img");r.id="celebration-gif",r.src=t,r.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:1000;border-radius:12px;",e.appendChild(r),setTimeout(()=>{r.parentNode&&r.remove()},4e3)})(r),c()},300)},500)),g.textContent=Math.floor(i).toString()},2e3/60)}),t}function c(){try{let e=new Audio(chrome.runtime.getURL("assets/sounds/cha-ching.mp3"));e.volume=.5,e.play().catch(()=>{})}catch(e){}}let p=!1;async function g(e){try{let t=a(e),o=await chrome.storage.local.get(["currentLevel","levelUpShownAt"]),r=o.currentLevel;if(null==r){if(t.current.sales>10){let e=`${t.current.sales}-10`;await chrome.storage.local.set({currentLevel:t.current.sales,levelUpDate:new Date().toISOString(),levelUpShownAt:e}),p||h(t).catch(()=>{})}else await chrome.storage.local.set({currentLevel:t.current.sales,levelUpDate:new Date().toISOString()});return}if(t.current.sales>r){let e=`${t.current.sales}-${r}`,i=o.levelUpShownAt;i===e||(await chrome.storage.local.set({currentLevel:t.current.sales,levelUpDate:new Date().toISOString(),levelUpShownAt:e}),p||h(t).catch(()=>{}))}}catch(e){}}async function h(e){let t=document.getElementById("merchghost-level-up-modal");t&&t.remove();let o=await d(e);document.body.appendChild(o),setTimeout(async()=>{try{let e=await chrome.storage.local.get(["theme"]),t="dark"===e.theme?"dark":"light";"dark"===t&&o.classList.add("dark-mode")}catch(e){}},50),setTimeout(()=>{o.classList.add("show"),p=!0},100),setTimeout(()=>{p=!1},5e3)}function m(){if(document.getElementById("merchghost-level-styles"))return;let e=document.createElement("style");e.id="merchghost-level-styles",e.textContent=`
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
  `,document.head.appendChild(e)}},{"@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}]},["cl0TT"],"cl0TT","parcelRequire4b19"),globalThis.define=t;