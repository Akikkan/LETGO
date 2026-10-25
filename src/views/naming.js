function filenamePart(value, fallback) {
  const clean=String(value||'').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').replace(/_+/g,'-');
  return clean||fallback;
}
function filenameTime(photo) {
  // Preserve the camera's recorded wall time; do not convert it to the browser timezone.
  const source=String(photo.capturedAt||photo.name||'');
  const match=source.match(/((?:19|20)\d{2})[-:]?(\d{2})[-:]?(\d{2})[T _-]?(\d{2})[:\-]?(\d{2})[:\-]?(\d{2})/);
  if(!match)return {text:'未知时间',source:'缺少拍摄时间'};
  const [,y,m,d,h,min,sec]=match;const date=new Date(Date.UTC(+y,+m-1,+d,+h,+min,+sec));
  if(date.getUTCFullYear()!==+y||date.getUTCMonth()!==+m-1||date.getUTCDate()!==+d||+h>23||+min>59||+sec>59)return {text:'未知时间',source:'拍摄时间无效'};
  return {text:`${y}${m}${d}-${h}${min}${sec}`,source:photo.capturedAt?'素材拍摄时间':'原文件名中的时间'};
}
function filenamePlans(s,photos) {
  const used=new Set();
  return photos.filter(p=>p.status==='keep').map(photo=>{
    const trip=filenamePart(s.trip||s.name,'未命名旅程');const location=filenamePart(s.collection,'未指定地点');
    const type=filenamePart(photo.category||photo.tags?.[0],photo.kind==='video'?'视频':'照片');
    const time=filenameTime(photo);const extension=String(photo.extension||photo.name?.match(/\.([a-z0-9]{1,12})$/i)?.[1]||'').replace(/^\.+/,'').replace(/[^a-z0-9]/gi,'');
    const base=`${trip}_${location}_${type}_${time.text}`;let name=base+(extension?'.'+extension:'');let n=2;
    while(used.has(name.toLowerCase()))name=base+'_'+String(n++).padStart(2,'0')+(extension?'.'+extension:'');
    used.add(name.toLowerCase());return {photo,name,timeSource:time.source};
  });
}
