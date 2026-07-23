var e,t;"function"==typeof(e=globalThis.define)&&(t=e,e=null),function(t,r,n,a,o){var s="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},l="function"==typeof s[a]&&s[a],i=l.cache||{},d="undefined"!=typeof module&&"function"==typeof module.require&&module.require.bind(module);function c(e,r){if(!i[e]){if(!t[e]){var n="function"==typeof s[a]&&s[a];if(!r&&n)return n(e,!0);if(l)return l(e,!0);if(d&&"string"==typeof e)return d(e);var o=Error("Cannot find module '"+e+"'");throw o.code="MODULE_NOT_FOUND",o}p.resolve=function(r){var n=t[e][1][r];return null!=n?n:r},p.cache={};var u=i[e]=new c.Module(e);t[e][0].call(u.exports,p,u,u.exports,this)}return i[e].exports;function p(e){var t=p.resolve(e);return!1===t?{}:c(t)}}c.isParcelRequire=!0,c.Module=function(e){this.id=e,this.bundle=c,this.exports={}},c.modules=t,c.cache=i,c.parent=l,c.register=function(e,r){t[e]=[function(e,t){t.exports=r},{}]},Object.defineProperty(c,"root",{get:function(){return s[a]}}),s[a]=c;for(var u=0;u<r.length;u++)c(r[u]);if(n){var p=c(n);"object"==typeof exports&&"undefined"!=typeof module?module.exports=p:"function"==typeof e&&e.amd?e(function(){return p}):o&&(this[o]=p)}}({PbIgl:[function(e,t,r){var n=e("@parcel/transformer-js/src/esmodule-helpers.js");n.defineInteropFlag(r),n.export(r,"config",()=>l),n.export(r,"sortBySalesRank",()=>g),n.export(r,"sortByReviews",()=>b),n.export(r,"sortByPrice",()=>y),n.export(r,"sortByDate",()=>x),n.export(r,"createFilterButtons",()=>S),n.export(r,"sortProductsByPublicationDate",()=>C),n.export(r,"addPublicationDateSortOption",()=>z);var a=e("./averageBSR"),o=e("./productCounter");let s=void 0!==window.jQuery?window.jQuery:void 0!==window.$?window.$:null,l={matches:["https://www.amazon.com/*","https://www.amazon.ca/*","https://www.amazon.co.uk/*","https://www.amazon.de/*","https://www.amazon.fr/*","https://www.amazon.it/*","https://www.amazon.es/*","https://www.amazon.in/*","https://www.amazon.com.au/*","https://www.amazon.com.br/*","https://www.amazon.com.mx/*","https://www.amazon.nl/*","https://www.amazon.se/*","https://www.amazon.pl/*","https://www.amazon.ae/*","https://www.amazon.sg/*","https://www.amazon.co.jp/*"],run_at:"document_idle"};function i(){if(s){let e=s(".s-result-list").has(".s-result-item[data-asin].prdm-rank-done").first();return e.length>0?e[0]:null}let e=document.querySelectorAll(".s-result-list");for(let t of e)if(t.querySelector(".s-result-item[data-asin].prdm-rank-done"))return t;return null}function d(e){if(!e)return;if(s){s(e).find('.s-result-item[data-sales-rank="0"].prdm-rank-done').removeClass("prdm-hidden");return}let t=e.querySelectorAll('.s-result-item[data-sales-rank="0"].prdm-rank-done');t.forEach(e=>e.classList.remove("prdm-hidden"))}function c(e,t){if(!e)return;if(s){let r=s(e);r.find(".s-result-item[data-asin].prdm-rank-done").remove();let n=s(t);r.find(".s-result-item[data-asin]").length?n.insertAfter(r.find(".s-result-item:first")):n.appendTo(r);return}let r=e.querySelectorAll(".s-result-item[data-asin].prdm-rank-done");r.forEach(e=>e.remove());let n=e.querySelector(".s-result-item[data-asin]");n&&n.parentNode?t.forEach(e=>{n.parentNode.insertBefore(e,n.nextSibling)}):t.forEach(t=>e.appendChild(t))}function u(e){if(null==e)return 0;if("number"==typeof e)return e;if("string"==typeof e){let t=parseFloat(e.replace(/[^\d.-]/g,""));return isNaN(t)?0:t}return 0}let p="",m="",f="",h="",w=!1;function g(){p="asc"===p?"desc":"asc",m="",f="",h="";let e=i();if(!e)return;d(e);let t=[];if(s){let r=s(e),n=r.find(".s-result-item[data-asin].prdm-rank-done").detach();(t=Array.from(n).map(e=>e)).sort((e,t)=>{let r=u(s(e).data("sales-rank")),n=u(s(t).data("sales-rank")),a=0===r,o=0===n;return a&&o?0:a?"asc"===p?-1:1:o?"asc"===p?1:-1:"asc"===p?n-r:r-n})}else{let r=e.querySelectorAll(".s-result-item[data-asin].prdm-rank-done");(t=Array.from(r)).forEach(e=>e.remove()),t.sort((e,t)=>{let r=u(parseFloat(e.getAttribute("data-sales-rank")||"0")),n=u(parseFloat(t.getAttribute("data-sales-rank")||"0")),a=0===r,o=0===n;return a&&o?0:a?"asc"===p?-1:1:o?"asc"===p?1:-1:"asc"===p?n-r:r-n})}c(e,t)}function b(){m="desc"===m?"asc":"desc",p="",f="",h="";let e=i();if(!e)return;d(e);let t=[];if(s){let r=s(e),n=r.find(".s-result-item[data-asin].prdm-rank-done").detach();(t=Array.from(n).map(e=>e)).sort((e,t)=>{let r=u(s(e).data("reviews")),n=u(s(t).data("reviews"));return"desc"===m?r-n:n-r})}else{let r=e.querySelectorAll(".s-result-item[data-asin].prdm-rank-done");(t=Array.from(r)).forEach(e=>e.remove()),t.sort((e,t)=>{let r=u(parseFloat(e.getAttribute("data-reviews")||"0")),n=u(parseFloat(t.getAttribute("data-reviews")||"0"));return"desc"===m?r-n:n-r})}c(e,t)}function y(){f="desc"===f?"asc":"desc",p="",m="",h="";let e=i();if(!e)return;d(e);let t=[];if(s){let r=s(e),n=r.find(".s-result-item[data-asin].prdm-rank-done").detach();(t=Array.from(n).map(e=>e)).sort((e,t)=>{let r=u(s(e).data("sales-price")),n=u(s(t).data("sales-price"));return"desc"===f?n-r:r-n})}else{let r=e.querySelectorAll(".s-result-item[data-asin].prdm-rank-done");(t=Array.from(r)).forEach(e=>e.remove()),t.sort((e,t)=>{let r=u(parseFloat(e.getAttribute("data-sales-price")||"0")),n=u(parseFloat(t.getAttribute("data-sales-price")||"0"));return"desc"===f?n-r:r-n})}c(e,t)}function x(){h="asc"===h?"desc":"asc",p="",m="",f="";let e=i();if(!e)return;d(e);let t=[];if(s){let r=s(e),n=r.find(".s-result-item[data-asin].prdm-rank-done").detach();(t=Array.from(n).map(e=>e)).sort((e,t)=>{let r=u(s(e).data("sales-upload-date")),n=u(s(t).data("sales-upload-date"));return"asc"===h?r-n:n-r})}else{let r=e.querySelectorAll(".s-result-item[data-asin].prdm-rank-done");(t=Array.from(r)).forEach(e=>e.remove()),t.sort((e,t)=>{let r=u(parseFloat(e.getAttribute("data-sales-upload-date")||"0")),n=u(parseFloat(t.getAttribute("data-sales-upload-date")||"0"));return"asc"===h?r-n:n-r})}c(e,t)}function v(e){let t=document.createElement("span");return t.className=`merchghost-sort-icon sort-${e}`,t.setAttribute("aria-hidden","true"),t}function S(){!function(){let e="merchghost-filter-styles";if(document.getElementById(e))return;let t=document.createElement("style");t.id=e,t.textContent=`
    .merchghost-filter-container {
      display: flex;
      align-items: center;
      gap: 0;
      margin: 0 0 16px 0;
      padding: 12px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: none;
      width: 100%;
      box-sizing: border-box;
      font-family: "Amazon Ember", Arial, sans-serif;
    }
    
    .merchghost-filter-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 0;
      align-items: center;
    }
    
    .merchghost-filter-btn {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      padding: 10px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      min-height: 38px;
      box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
    }
    
    .merchghost-filter-btn:hover:not(:disabled) {
      background: #0056b3;
      box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
      transform: translateY(-1px);
    }
    
    .merchghost-filter-btn:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
      background: #004085;
    }
    
    .merchghost-filter-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: #6c757d;
    }
    
    .merchghost-sort-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      position: relative;
      margin-right: 6px;
      flex-shrink: 0;
    }
    
    .merchghost-sort-icon.sort-default {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
    }
    
    .merchghost-sort-icon.sort-default::before {
      content: '';
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid rgba(255, 255, 255, 0.8);
      display: block;
      margin-bottom: 1px;
    }
    
    .merchghost-sort-icon.sort-default::after {
      content: '';
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 4px solid rgba(255, 255, 255, 0.8);
      display: block;
    }
    
    .merchghost-sort-icon.sort-up {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    
    .merchghost-sort-icon.sort-up::before {
      content: '';
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 7px solid white;
      display: block;
    }
    
    .merchghost-sort-icon.sort-up::after {
      display: none;
    }
    
    .merchghost-sort-icon.sort-down {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    
    .merchghost-sort-icon.sort-down::before {
      content: '';
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 7px solid white;
      display: block;
    }
    
    .merchghost-sort-icon.sort-down::after {
      display: none;
    }
    
    .merchghost-filter-btn .merchghost-sort-icon {
      color: white;
      opacity: 1;
    }
    
    .merchghost-filter-btn.loading .merchghost-sort-icon {
      animation: merchghost-pulse 1.5s ease-in-out infinite;
    }
    
    @keyframes merchghost-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .prdm-hidden {
      display: none !important;
    }
    
    .merchghost-filter-btn * {
      box-sizing: border-box;
    }
  `,document.head.appendChild(t)}();let e=document.createElement("div");e.className="merchghost-filter-container";let t=document.createElement("div");t.className="merchghost-filter-toolbar";let r=document.createElement("button");r.className="merchghost-filter-btn",r.setAttribute("data-title","Sort Result by Sales Rank");let n=v(w?"default":"asc"===p?"up":"desc"===p?"down":"default");r.appendChild(n),r.appendChild(document.createTextNode("Sales Rank (BSR)")),r.addEventListener("click",()=>{w=!0,C(),g(),w=!1,C(),setTimeout(()=>{(0,a.updateAverageBSRDisplay)(),(0,o.updateProductCountDisplay)()},100)});let s=document.createElement("button");s.className="merchghost-filter-btn",s.setAttribute("data-title","Sort Result by Reviews");let l=v(w?"default":"asc"===m?"up":"desc"===m?"down":"default");s.appendChild(l),s.appendChild(document.createTextNode("Reviews")),s.addEventListener("click",()=>{w=!0,C(),b(),w=!1,C(),setTimeout(()=>{(0,a.updateAverageBSRDisplay)(),(0,o.updateProductCountDisplay)()},100)});let i=document.createElement("button");i.className="merchghost-filter-btn",i.setAttribute("data-title","Sort Result by Price");let d=v(w?"default":"desc"===f?"up":"asc"===f?"down":"default");i.appendChild(d),i.appendChild(document.createTextNode("Price")),i.addEventListener("click",()=>{w=!0,C(),y(),w=!1,C(),setTimeout(()=>{(0,a.updateAverageBSRDisplay)(),(0,o.updateProductCountDisplay)()},100)});let c=document.createElement("button");c.className="merchghost-filter-btn",c.setAttribute("data-title","Sort Result by Added");let u=v(w?"default":"desc"===h?"up":"asc"===h?"down":"default");c.appendChild(u),c.appendChild(document.createTextNode("Date")),c.addEventListener("click",()=>{w=!0,C(),x(),w=!1,C(),setTimeout(()=>{(0,a.updateAverageBSRDisplay)(),(0,o.updateProductCountDisplay)()},100)}),t.appendChild(r),t.appendChild(s),t.appendChild(i),t.appendChild(c);let S=(0,a.createAverageBSRDisplay)();t.appendChild(S);let A=(0,o.createProductCountDisplay)();function C(){let e=v(w?"default":"asc"===p?"up":"desc"===p?"down":"default");r.replaceChild(e,n),n=e,r.disabled=w,w?r.classList.add("loading"):r.classList.remove("loading");let t=v(w?"default":"asc"===m?"up":"desc"===m?"down":"default");s.replaceChild(t,l),l=t,s.disabled=w,w?s.classList.add("loading"):s.classList.remove("loading");let a=v(w?"default":"desc"===f?"up":"asc"===f?"down":"default");i.replaceChild(a,d),d=a,i.disabled=w,w?i.classList.add("loading"):i.classList.remove("loading");let o=v(w?"default":"desc"===h?"up":"asc"===h?"down":"default");c.replaceChild(o,u),u=o,c.disabled=w,w?c.classList.add("loading"):c.classList.remove("loading")}return t.appendChild(A),setTimeout(()=>{(0,a.updateAverageBSRDisplay)(),(0,o.updateProductCountDisplay)()},1e3),e.appendChild(t),e}function A(e){try{let t=e.replace(/[\u200e\u200f]/g,"").trim(),r=new Date(t);if(!isNaN(r.getTime()))return r;let n=t.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i);if(n){let e=new Date(n[0]);if(!isNaN(e.getTime()))return e}let a=t.match(/\d{4}-\d{1,2}-\d{1,2}/);if(a){let e=new Date(a[0]);if(!isNaN(e.getTime()))return e}let o=t.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);if(o){let[,e,t,r]=o,n=new Date(parseInt(r),parseInt(e)-1,parseInt(t));if(!isNaN(n.getTime()))return n}return null}catch(e){return null}}function C(){"undefined"!=typeof window&&(window.sortProductsByPublicationDate=C);try{let e=document.querySelector('.s-result-list, [data-component-type="s-search-result-list"]');if(!e)return;let t=Array.from(document.querySelectorAll('[data-component-type="s-search-result"]'));if(0===t.length)return;let r=t.map(e=>{let t=function(e){try{let t=e.querySelector("[data-merchghost-info]")||e.querySelector(".amazon-scraper-enhanced-info");if(t){let e=t.textContent||"",r=e.match(/Date:\s*([^\n]+)/i);if(r&&r[1]){let e=r[1].trim(),t=A(e);if(t)return t}}let r=e.textContent||"";for(let e of[/Date:\s*([^\n]+)/i,/(?:Date First Available|Publication date|First Available):\s*([^\n]+)/i]){let t=r.match(e);if(t&&t[1]){let e=A(t[1].trim());if(e)return e}}return null}catch(e){return null}}(e);return{card:e,date:t||new Date(0),hasDate:null!==t}});r.sort((e,t)=>e.hasDate&&!t.hasDate?-1:!e.hasDate&&t.hasDate?1:t.date.getTime()-e.date.getTime());let n=document.createDocumentFragment();r.forEach(e=>{n.appendChild(e.card)}),e.innerHTML="",e.appendChild(n)}catch(e){}}function z(){try{let e=document.querySelector("#a-autoid-0-announce")||document.querySelector('[data-action="a-dropdown-button"]')||document.querySelector(".a-dropdown-prompt")?.closest('[data-action="a-dropdown-button"]');if(!e){setTimeout(z,2e3);return}let t=e.getAttribute("aria-owns")||e.getAttribute("aria-controls")||e.closest(".a-dropdown-container")?.querySelector('[id^="a-popover"]')?.id;if(document.querySelector('[data-merchghost-sort="publication-date"]'))return;let r=()=>{try{document.querySelector("#a-popover-"+t)||document.querySelector('[id*="popover"]')||document.querySelector('.a-popover-inner ul[role="listbox"]')?.closest(".a-popover-inner");let e=document.querySelector('.a-popover-inner ul[role="listbox"]')||document.querySelector('[role="listbox"]')||document.querySelector(".a-popover-content ul");if(!e||e.querySelector('[data-merchghost-sort="publication-date"]'))return;let r=document.createElement("li");r.setAttribute("data-merchghost-sort","publication-date"),r.setAttribute("role","option"),r.className="a-dropdown-item",r.style.cssText=`
          padding: 8px 16px;
          cursor: pointer;
          list-style: none;
          border-top: 1px solid #e0e0e0;
        `,r.innerHTML=`
          <span class="a-dropdown-link">Newest Publication Date</span>
        `,r.addEventListener("click",e=>{e.preventDefault(),e.stopPropagation();try{C();let e=document.querySelector(".a-dropdown-prompt");e&&(e.textContent="Newest Publication Date"),setTimeout(()=>{let e=document.querySelector('[data-action="a-dropdown-button"]');e&&e.click()},100)}catch(e){}}),r.addEventListener("mouseenter",()=>{r.style.backgroundColor="#f0f0f0"}),r.addEventListener("mouseleave",()=>{r.style.backgroundColor="transparent"}),e.appendChild(r)}catch(e){}},n=new MutationObserver(()=>{document.querySelector('.a-popover-inner ul[role="listbox"]')&&r()});n.observe(document.body,{childList:!0,subtree:!0}),e instanceof HTMLElement&&setTimeout(()=>{e.click(),setTimeout(()=>{r(),setTimeout(()=>{e.click()},500)},300)},1e3)}catch(e){}}"undefined"!=typeof window&&(window.sortBySalesRank=g,window.sortByReviews=b,window.sortByPrice=y,window.sortByDate=x,window.createFilterButtons=S,window.sortProductsByPublicationDate=C,window.addPublicationDateSortOption=z)},{"./averageBSR":"1JlJ7","./productCounter":"1p3hm","@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}],"1JlJ7":[function(e,t,r){var n=e("@parcel/transformer-js/src/esmodule-helpers.js");n.defineInteropFlag(r),n.export(r,"config",()=>a),n.export(r,"calculateAverageBSR",()=>l),n.export(r,"createAverageBSRDisplay",()=>i),n.export(r,"updateAverageBSRDisplay",()=>d);let a={matches:["https://www.amazon.com/*","https://www.amazon.ca/*","https://www.amazon.co.uk/*","https://www.amazon.de/*","https://www.amazon.fr/*","https://www.amazon.it/*","https://www.amazon.es/*","https://www.amazon.in/*","https://www.amazon.com.au/*","https://www.amazon.com.br/*","https://www.amazon.com.mx/*","https://www.amazon.nl/*","https://www.amazon.se/*","https://www.amazon.pl/*","https://www.amazon.ae/*","https://www.amazon.sg/*","https://www.amazon.co.jp/*"],run_at:"document_idle"};function o(e){let t=e.getAttribute("data-asin");if(!t||""===t.trim())return!1;let r=e.classList.contains("prdm-rank-done");return!(!r||function(e){if(!e)return!1;if(e.querySelector(".puis-sponsored-label-text")||e.querySelector('a[href*="/sspa/click"], a[href*="slredirect"]'))return!0;let t=e.getAttribute("data-component-type")||"";if("sp-sponsored-result"===t||e.querySelector(".s-label-popover-default"))return!0;let r=e.textContent||"";return!!/\bSponsored\b|\bSponsoris\u00e9\b|\bPatrocinado\b|\bGesponsert\b|\bSponsorizzato\b|\bSponsrad\b/i.test(r)}(e))}function s(e){let t=e.closest(".s-result-list");if(!t)return!1;let r=t.previousElementSibling;if(!r)return!1;let n=r.textContent||"";return!!(n.includes("4 stars and above")||n.includes("Social media picks")||n.includes("Sponsored"))}function l(){try{let e=document.querySelectorAll(".s-result-item[data-asin].prdm-rank-done");if(0===e.length)return null;let t=0,r=0;if(e.forEach(e=>{if(!o(e)||s(e))return;let n=e.getAttribute("data-sales-rank"),a=function(e){if(null==e)return 0;if("number"==typeof e)return e;if("string"==typeof e){let t=parseFloat(e.replace(/[^\d.-]/g,""));return isNaN(t)?0:t}return 0}(n);a>0&&(t+=a,r++)}),0===r)return null;let n=Math.round(t/r);return{average:n,count:r,total:e.length}}catch(e){return console.error("[AverageBSR] Error calculating:",e),null}}function i(){let e=document.createElement("div");e.id="merchghost-average-bsr",e.style.cssText=`
    display: inline-flex;
    align-items: center;
    margin-left: 16px;
    padding: 0;
    font-family: "Amazon Ember", Arial, sans-serif;
    font-size: 14px;
    color: #000000;
    font-weight: normal;
    line-height: 1.5;
  `;let t=document.createElement("span");t.textContent="Average BSR: ",t.style.cssText=`
    color: #000000;
    font-weight: normal;
    margin-right: 4px;
  `;let r=document.createElement("span");return r.id="merchghost-average-bsr-value",r.textContent="Calculating...",r.style.cssText=`
    color: #000000;
    font-weight: normal;
  `,e.appendChild(t),e.appendChild(r),e}function d(){let e=document.getElementById("merchghost-average-bsr-value");if(!e)return;let t=document.querySelectorAll(".s-result-item[data-asin]"),r=document.querySelectorAll(".s-result-item[data-asin].prdm-rank-done");if(0===t.length){e.textContent="No products";return}let n=0,a=0;if(t.forEach(e=>{o(e)&&!s(e)&&n++}),r.forEach(e=>{o(e)&&!s(e)&&a++}),a<n){e.textContent=`Loading... (${a}/${n})`;return}let i=l();if(!i||0===i.count){e.textContent="N/A";return}let d=i.average.toLocaleString();e.textContent=d}function c(){let e=new MutationObserver(()=>{d()}),t=document.querySelector('.s-result-list, [data-component-type="s-search-result-list"]');t&&e.observe(t,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["class","data-sales-rank"]}),setInterval(()=>{d()},2e3)}"undefined"!=typeof window&&(window.calculateAverageBSR=l,window.createAverageBSRDisplay=i,window.updateAverageBSRDisplay=d,"loading"===document.readyState?document.addEventListener("DOMContentLoaded",()=>{setTimeout(c,2e3)}):setTimeout(c,2e3))},{"@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}],fRZO2:[function(e,t,r){r.interopDefault=function(e){return e&&e.__esModule?e:{default:e}},r.defineInteropFlag=function(e){Object.defineProperty(e,"__esModule",{value:!0})},r.exportAll=function(e,t){return Object.keys(e).forEach(function(r){"default"===r||"__esModule"===r||t.hasOwnProperty(r)||Object.defineProperty(t,r,{enumerable:!0,get:function(){return e[r]}})}),t},r.export=function(e,t,r){Object.defineProperty(e,t,{enumerable:!0,get:r})}},{}],"1p3hm":[function(e,t,r){var n=e("@parcel/transformer-js/src/esmodule-helpers.js");n.defineInteropFlag(r),n.export(r,"config",()=>a),n.export(r,"getRealProductCount",()=>s),n.export(r,"createProductCountDisplay",()=>l),n.export(r,"updateProductCountDisplay",()=>i);let a={matches:["https://www.amazon.com/*","https://www.amazon.ca/*","https://www.amazon.co.uk/*","https://www.amazon.de/*","https://www.amazon.fr/*","https://www.amazon.it/*","https://www.amazon.es/*","https://www.amazon.in/*","https://www.amazon.com.au/*","https://www.amazon.com.br/*","https://www.amazon.com.mx/*","https://www.amazon.nl/*","https://www.amazon.se/*","https://www.amazon.pl/*","https://www.amazon.ae/*","https://www.amazon.sg/*","https://www.amazon.co.jp/*"],run_at:"document_idle"};async function o(e){try{let t=new URL(window.location.href);t.searchParams.set("page",e.toString());let r=await fetch(t.toString(),{credentials:"same-origin",cache:"no-cache"});if(!r.ok)return null;let n=await r.text(),a=new DOMParser,o=a.parseFromString(n,"text/html"),s=o.querySelector(".s-result-count, h2.a-size-base.a-spacing-small");if(!s)return null;let l=s.textContent||"",i=l.match(/\d[\d,]*-(\d[\d,]*)\s+of\s+(?:over\s+)?(\d[\d,]*)\s+results/i);if(!i)return null;return parseInt(i[2].replace(/,/g,""))}catch(e){return console.error("[ProductCounter] Error fetching last page:",e),null}}async function s(){try{let e=function(){try{let e=document.querySelector(".s-result-count, h2.a-size-base.a-spacing-small");if(!e)return null;let t=e.textContent||"",r=t.match(/(\d[\d,]*)-(\d[\d,]*)\s+of\s+(?:over\s+)?(\d[\d,]*)\s+results/i);if(!r)return null;let n=parseInt(r[2].replace(/,/g,"")),a=1,o=document.querySelector('.s-pagination-container, [aria-label="pagination"]');if(o){let e=[],t=o.querySelectorAll("a.s-pagination-item, span.s-pagination-item");t.forEach(t=>{let r=t.textContent?.trim()||"",n=parseInt(r.replace(/,/g,""));!isNaN(n)&&n>0&&e.push(n)});let r=o.querySelector(".s-pagination-disabled");if(r){let t=r.textContent?.trim()||"",n=parseInt(t.replace(/,/g,""));!isNaN(n)&&n>0&&e.push(n)}e.length>0&&(a=Math.max(...e))}return{currentPosition:n,lastPage:a}}catch(e){return console.error("[ProductCounter] Error getting page info:",e),null}}();if(!e||e.lastPage<=1)return null;let t=e.lastPage>=3?3:e.lastPage,r=await o(t);if(null===r)return null;return{current:e.currentPosition,total:r}}catch(e){return console.error("[ProductCounter] Error getting real product count:",e),null}}function l(){let e=document.createElement("div");e.id="merchghost-product-count",e.style.cssText=`
    display: inline-flex;
    align-items: center;
    margin-left: 16px;
    padding: 0;
    font-family: "Amazon Ember", Arial, sans-serif;
    font-size: 14px;
    color: #000000;
    font-weight: normal;
    line-height: 1.5;
  `;let t=document.createElement("span");t.textContent="Product: ",t.style.cssText=`
    color: #000000;
    font-weight: normal;
    margin-right: 4px;
  `;let r=document.createElement("span");return r.id="merchghost-product-count-value",r.textContent="Loading...",r.style.cssText=`
    color: #000000;
    font-weight: normal;
  `,e.appendChild(t),e.appendChild(r),e}async function i(){let e=document.getElementById("merchghost-product-count-value");if(!e)return;let t=await s();if(!t){e.textContent="N/A";return}let r=t.current.toLocaleString(),n=t.total.toLocaleString();e.textContent=`${r} / ${n}`}"undefined"!=typeof window&&(window.getRealProductCount=s,window.createProductCountDisplay=l,window.updateProductCountDisplay=i)},{"@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}]},["PbIgl"],"PbIgl","parcelRequire4b19"),globalThis.define=t;