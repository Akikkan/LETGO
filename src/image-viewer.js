// Image coordinates stay independent of window size. The centre value always fits.
function createImageViewer(){
 let key=null,position=0,focusX=.5,focusY=.5,viewport=null,img=null,slider=null,mini=null,windowBox=null,observer=null,drag=null;
 let width=0,height=0,renderWidth=0,renderHeight=0,offsetX=0,offsetY=0,miniWidth=0,miniHeight=0;
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const scale=()=>position<0?Math.pow(4,position/100):Math.pow(8,position/100);
 function finishDrag(){if(!viewport)return;const pointer=drag?.id;drag=null;viewport.classList.remove('is-dragging');if(mini)mini.hidden=true;if(pointer!==undefined&&viewport.hasPointerCapture(pointer))viewport.releasePointerCapture(pointer);}
 function draw(){
  if(!viewport||!img?.naturalWidth||!img?.naturalHeight)return;
  width=viewport.clientWidth;height=viewport.clientHeight;if(!width||!height)return;
  const fit=Math.min(width/img.naturalWidth,height/img.naturalHeight),zoom=scale();renderWidth=img.naturalWidth*fit*zoom;renderHeight=img.naturalHeight*fit*zoom;
  offsetX=clamp((.5-focusX)*renderWidth,-Math.max(0,(renderWidth-width)/2),Math.max(0,(renderWidth-width)/2));
  offsetY=clamp((.5-focusY)*renderHeight,-Math.max(0,(renderHeight-height)/2),Math.max(0,(renderHeight-height)/2));
  focusX=.5-offsetX/renderWidth;focusY=.5-offsetY/renderHeight;
  img.style.width=`${renderWidth}px`;img.style.height=`${renderHeight}px`;img.style.transform=`translate3d(${(width-renderWidth)/2+offsetX}px,${(height-renderHeight)/2+offsetY}px,0)`;
  viewport.classList.toggle('can-pan',renderWidth>width+.5||renderHeight>height+.5);
  viewport.dataset.scale=String(zoom);viewport.dataset.panX=String(offsetX);viewport.dataset.panY=String(offsetY);
  slider.value=position;slider.disabled=false;slider.setAttribute('aria-valuetext',position===0?'适应窗口':`${Math.round(zoom*100)}%，相对于适应窗口`);
  const label=viewport.parentElement.querySelector('.zoom-value');label.textContent=position===0?'适应':`${Math.round(zoom*100)}%`;label.setAttribute('aria-label','重置为适应窗口');
  const thumbScale=Math.min(150/img.naturalWidth,100/img.naturalHeight);miniWidth=img.naturalWidth*thumbScale;miniHeight=img.naturalHeight*thumbScale;mini.style.width=`${miniWidth}px`;mini.style.height=`${miniHeight}px`;
  const left=(width-renderWidth)/2+offsetX,top=(height-renderHeight)/2+offsetY;
  const x0=clamp(-left/renderWidth,0,1),x1=clamp((width-left)/renderWidth,0,1),y0=clamp(-top/renderHeight,0,1),y1=clamp((height-top)/renderHeight,0,1);
  Object.assign(windowBox.style,{left:`${x0*miniWidth}px`,top:`${y0*miniHeight}px`,width:`${(x1-x0)*miniWidth}px`,height:`${(y1-y0)*miniHeight}px`});
 }
 function setZoom(value){position=clamp(Number(value)||0,-100,100);draw();}
 function pointerDown(event){if(event.button!==0||!viewport.classList.contains('can-pan'))return;event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY,offsetX,offsetY};viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');mini.hidden=false;}
 function pointerMove(event){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();focusX=.5-(drag.offsetX+event.clientX-drag.x)/renderWidth;focusY=.5-(drag.offsetY+event.clientY-drag.y)/renderHeight;draw();}
 function pointerEnd(event){if(event.pointerId===drag?.id)finishDrag();}
 function onWheel(event){
  if(!viewport||!img?.naturalWidth||!img?.naturalHeight)return;
  event.preventDefault();
  const delta = -Math.max(-12, Math.min(12, event.deltaY * 0.08));
  const newPos = clamp(position + delta, -100, 100);
  if(Math.abs(newPos - position) < 0.01) return;
  if(width && height && renderWidth && renderHeight){
   const rect = viewport.getBoundingClientRect();
   const cursorX = event.clientX - rect.left, cursorY = event.clientY - rect.top;
   const currentLeft = (width - renderWidth) / 2 + offsetX, currentTop = (height - renderHeight) / 2 + offsetY;
   if(cursorX >= currentLeft && cursorX <= currentLeft + renderWidth && cursorY >= currentTop && cursorY <= currentTop + renderHeight){
    focusX = (cursorX - currentLeft) / renderWidth;
    focusY = (cursorY - currentTop) / renderHeight;
   }
  }
  setZoom(newPos);
 }
 function reset(){finishDrag();position=0;focusX=focusY=.5;draw();}
 function detach(){finishDrag();observer?.disconnect();observer=null;window.removeEventListener('blur',finishDrag);if(viewport){viewport.removeEventListener('pointerdown',pointerDown);viewport.removeEventListener('pointermove',pointerMove);viewport.removeEventListener('pointerup',pointerEnd);viewport.removeEventListener('pointercancel',pointerEnd);viewport.removeEventListener('lostpointercapture',finishDrag);viewport.removeEventListener('dblclick',reset);viewport.removeEventListener('wheel',onWheel);}viewport=null;img=null;}
 function mount(container,mediaKey){detach();if(key!==mediaKey){key=mediaKey;position=0;focusX=focusY=.5;}viewport=container.querySelector('.image-viewport');img=viewport?.querySelector('.review-image');if(!img){viewport=null;return;}
  slider=container.querySelector('.zoom-slider');mini=container.querySelector('.image-minimap');windowBox=container.querySelector('.minimap-window');slider.value=position;slider.disabled=!img.complete||!img.naturalWidth;
  img.draggable=false;img.addEventListener('dragstart',event=>event.preventDefault());img.addEventListener('load',draw,{once:true});img.addEventListener('error',()=>{slider.disabled=true;finishDrag()},{once:true});
  slider.addEventListener('input',()=>setZoom(slider.value));container.querySelector('[data-zoom=reset]').addEventListener('click',reset);container.querySelector('[data-zoom=out]').addEventListener('click',()=>setZoom(position-10));container.querySelector('[data-zoom=in]').addEventListener('click',()=>setZoom(position+10));
  viewport.addEventListener('pointerdown',pointerDown);viewport.addEventListener('pointermove',pointerMove);viewport.addEventListener('pointerup',pointerEnd);viewport.addEventListener('pointercancel',pointerEnd);viewport.addEventListener('lostpointercapture',finishDrag);viewport.addEventListener('dblclick',reset);viewport.addEventListener('wheel',onWheel,{passive:false});window.addEventListener('blur',finishDrag);
  observer=new ResizeObserver(()=>{finishDrag();draw()});observer.observe(viewport);draw();
 }
 return{mount,detach,reset};
}
