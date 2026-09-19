export function connectionMode(){try{return localStorage.getItem('worklow-connection-mode')==='pymthouse'?'pymthouse':'keyless'}catch{return 'keyless'}}
export function setConnectionMode(mode){if(!['keyless','pymthouse'].includes(mode))throw Error('Choose a connection mode.');localStorage.setItem('worklow-connection-mode',mode);}
export const connectionHeaders=(mode=connectionMode())=>({'Content-Type':'application/json','X-Worklow-Mode':mode});
