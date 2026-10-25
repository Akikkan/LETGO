const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(channel,...args)=>{const result=await ipcRenderer.invoke(channel,...args);if(!result.ok)throw new Error(result.error);return result.value;};
contextBridge.exposeInMainWorld('shiguang',{
 bootstrap:()=>invoke('app:bootstrap'),appearance:value=>invoke('app:appearance',value),
 choose:()=>invoke('workspace:choose'),load:id=>invoke('workspace:load',id),list:()=>invoke('workspace:list'),rescan:id=>invoke('workspace:rescan',id),save:(id,value)=>invoke('workspace:save',id,value),
 metadata:(id,itemId)=>invoke('item:metadata',id,itemId),
 plan:id=>invoke('workspace:plan',id),execute:(id,token)=>invoke('workspace:execute',id,token),reveal:id=>invoke('workspace:reveal',id),
 exportManifest:id=>invoke('agent:export',id),importSuggestions:id=>invoke('agent:import',id),
 onProgress:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('workspace:progress',listener);return()=>ipcRenderer.removeListener('workspace:progress',listener)}
});
