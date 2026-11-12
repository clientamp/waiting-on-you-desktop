import{host as Je,useValue as Zd}from"@hermes/plugin-sdk";import{useSyncExternalStore as Vd}from"react";import{host as sn,useValue as Jr,Button as Bn,Dialog as Hp,DialogContent as Gp,DialogDescription as Pu,DialogFooter as Ts,DialogHeader as Up,DialogTitle as Kp}from"@hermes/plugin-sdk";import{useCallback as $u,useEffect as Hn,useState as bt,useSyncExternalStore as Wp}from"react";var Or=["gray","red","orange","yellow","green","teal","blue","purple","pink"];function In(e){return Or.includes(e??"")?e:"gray"}function qa(e){return e.status==="done"||e.status==="dismissed"||e.status==="expired"}var Bi=[1,2,3,4];function Rp(e){if(e.length===0)return"";let t=new Map;for(let s of e)t.set(s.topic,(t.get(s.topic)??0)+1);let n=e[0].topic,a=0;for(let[s,l]of t)l>a&&(n=s,a=l);return n||e[0].chat_title}function Co(e,t=!1,n=!1){let a=e.title_override?.trim();if(a)return a;if(!n){let l=e.chat_name?.trim();if(l)return l}if(t){let l=e.chat_title?.trim();if(l)return l}return e.topic?.trim()||e.chat_title||""}function Jo(e,t=!1){if(e.title_locked){let a=e.title?.trim();if(a)return a}if(t){let a=e.chat_title?.trim();if(a)return a}return e.title?.trim()||e.chat_title||""}function Hi(e,t,n="newest"){let a=new Map;for(let m of e){let w=a.get(m.chat_key)??[];w.push(m),a.set(m.chat_key,w)}let s=new Map(t.map(m=>[m.chat_key,m])),l=[],c=n==="oldest"?(m,w)=>So(m)-So(w):(m,w)=>So(w)-So(m);for(let[m,w]of a)if(w.length>=2){let f=s.get(m),h=[...w].sort(c),_=n==="oldest"?Math.min(...w.map(b=>So(b))):Math.max(...w.map(b=>So(b))),v=f?.quadrant??Math.min(...w.map(b=>b.quadrant)),x={chat_key:m,title:f?.title??Rp(w),title_locked:f?.title_locked??!1,quadrant:v,task_ids:h.map(b=>b.id),agent:w[0].agent,chat_title:w[0].chat_title,chat_target:f?.chat_target??w.find(b=>b.chat_target)?.chat_target??null};l.push({kind:"group",group:x,tasks:h,sortAt:_})}else for(let f of w)l.push({kind:"task",task:f,sortAt:So(f)});let p={1:[],2:[],3:[],4:[]},d=n==="oldest"?(m,w)=>m.sortAt-w.sortAt:(m,w)=>w.sortAt-m.sortAt;for(let m of l){let w=m.kind==="task"?m.task.quadrant:m.group.quadrant;w>=1&&w<=4&&p[w].push(m)}for(let m of Bi)p[m].sort(d);return p}function Va(e){let t=0;for(let n of e)n.kind==="task"?t+=1:t+=n.tasks.length;return t}function Wa(e){let t=new Date(e);return t.setHours(8,0,0,0),Math.floor(t.getTime()/1e3)}function Xt(e){let t=new Date(e);t.setDate(t.getDate()+1);let n=new Date(e),s=(8-n.getDay())%7;s===0&&(s=7),n.setDate(n.getDate()+s);let l=new Date(e);return l.setDate(l.getDate()+7),{tomorrow:Wa(t),nextMonday:Wa(n),inWeek:Wa(l)}}var Gi={1:"Urgent & Important",2:"Important & Not Urgent",3:"Urgent & Not Important",4:"Not Urgent & Not Important"};function Fr(e){return e>=1&&e<=4?Gi[e]:`Quadrant ${e}`}function jr(e){if(!e||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e))return null;let t=new Date(e).getTime();return Number.isFinite(t)?Math.floor(t/1e3):null}function Dn(e){let t=new Date(e*1e3),n=a=>String(a).padStart(2,"0");return`${t.getFullYear()}-${n(t.getMonth()+1)}-${n(t.getDate())}T${n(t.getHours())}:${n(t.getMinutes())}`}function en(e){let t=new Date(e);return t.setDate(t.getDate()+1),t.setHours(8,0,0,0),Dn(Math.floor(t.getTime()/1e3))}function Ya(e){return new Date(e*1e3).toLocaleString(void 0,{dateStyle:"medium",timeStyle:"short"})}function Xa(e){let t=e.source_msg_at;return t!=null&&Number.isFinite(t)&&t>0?t:e.updated_at}function So(e){let t=e.source_msg_at;return t!=null&&Number.isFinite(t)&&t>0?t:e.created_at}function zr(e,t){if(!Number.isFinite(e))return"";let n=e*1e3,a=t.getTime()-n;if(a<6e4)return"just now";let s=Math.floor(a/6e4);if(s<60)return`${s} min ago`;let l=Math.floor(s/60);if(l<24)return l===1?"1 hour ago":`${l} hours ago`;let c=new Date(n);return c.toLocaleDateString(void 0,{month:"short",day:"numeric",year:t.getFullYear()!==c.getFullYear()?"numeric":void 0})}function Br(e){return Number.isFinite(e)?new Date(e*1e3).toLocaleString(void 0,{dateStyle:"full",timeStyle:"short"}):""}function Ui(e){let t=0;for(let n of e){let a=Xa(n);Number.isFinite(a)&&a>t&&(t=a)}return t}function Ki(e,t="newest"){let n=[...e[1],...e[2],...e[3],...e[4]],a=t==="oldest"?(s,l)=>s.sortAt-l.sortAt:(s,l)=>l.sortAt-s.sortAt;return n.sort(a),n}function Wi(e,t){if(!Number.isFinite(e))return"";let n=e*1e3,a=t.getTime()-n;if(a<6e4)return"just now";let s=Math.floor(a/6e4);if(s<60)return`${s} min ago`;let l=new Date(t);l.setHours(0,0,0,0);let c=new Date(l);if(c.setDate(c.getDate()-1),n>=c.getTime()&&n<l.getTime())return"yesterday";let p=Math.floor(s/60);return p<24?`${p} h ago`:new Date(n).toLocaleDateString(void 0,{month:"short",day:"numeric",year:t.getFullYear()!==new Date(n).getFullYear()?"numeric":void 0})}function Ep(e){return e.project?.key??null}function wt(e){return Array.isArray(e.tags)?e.tags:[]}function Qi(e){if(e==="all")return"all";if(e==="none")return["none"];if(typeof e=="string"&&e.trim()!=="")return[e];if(Array.isArray(e)){let t=[];for(let n of e)typeof n!="string"||n.trim()===""||t.includes(n)||t.push(n);return t.length===0?"all":t}return"all"}function qi(e,t){if(e==="all")return"all";let n=new Set(t),a=e.filter(s=>s==="none"||n.has(s));return a.length===e.length?e:a.length===0?"all":a}function Za(e,t){if(e==="all")return[t];if(e.includes(t)){let n=e.filter(a=>a!==t);return n.length===0?"all":n}return[...e,t]}function Vi(e){if(!Array.isArray(e))return[];let t=[];for(let n of e){let a=typeof n=="number"?n:typeof n=="string"?Number(n):NaN;!Number.isInteger(a)||t.includes(a)||t.push(a)}return t}function Yi(e,t){let n=new Set(t),a=e.filter(s=>n.has(s));return a.length===e.length?e:a}function Xi(e,t){return e.includes(t)?e.filter(n=>n!==t):[...e,t]}function Zi(e){return e==="all"?!0:e.length>=2}function Ja(e){let t=[],n=new Set;for(let a of e){let s=a.project;!s||n.has(s.key)||(n.add(s.key),t.push(s))}return t}function Ji(e){let t=[],n=new Set;for(let a of e)for(let s of wt(a))n.has(s.id)||(n.add(s.id),t.push(s));return t}function Hr(e,t){if(e.length===0)return"none";let n=0;for(let a of e)wt(a).some(s=>s.id===t)&&(n+=1);return n===0?"none":n===e.length?"all":"some"}function el(e,t=3){return e.length<=t?{shown:e,extra:0}:{shown:e.slice(0,t),extra:e.length-t}}function es(e,t,n,a=[]){if(t!=="all"&&e.agent!==t)return!1;if(n!=="all"){let s=Ep(e);if(!n.includes(s??"none"))return!1}if(a.length>0){let s=new Set(wt(e).map(l=>l.id));if(!a.every(l=>s.has(l)))return!1}return!0}function ts(e,t,n,a=[]){return t==="all"&&n==="all"&&a.length===0?e:e.filter(s=>es(s,t,n,a))}function os(e){let t=new Map;for(let a of e)t.set(a.chat_key,(t.get(a.chat_key)??0)+1);let n=0;for(let a of t.values())a>=2&&(n+=a);return{main:t.size,sub:n}}function Ip(e){let t=0;for(let n of e)n.kind==="group"&&(t+=n.tasks.length);return{main:e.length,sub:t}}function ns(e){return rs(Ip(e))}function tl(e){return`Show all ${ns(e)}`}function rs(e){let t=`${e.main} ${e.main===1?"task":"tasks"}`;return e.sub===0?t:`${t}, ${e.sub} ${e.sub===1?"subtask":"subtasks"}`}function ol(e){return`All agents: ${rs(e)}`}function nl(e,t){return`${e}: ${rs(t)}`}function rl(e){let t=new Map;for(let n of e)t.set(n.agent,[...t.get(n.agent)??[],n]);return[...t.entries()].map(([n,a])=>({agent:n,counts:os(a)})).sort((n,a)=>a.counts.main-n.counts.main||n.agent.localeCompare(a.agent))}var al={debounce_seconds:[30,600],sweep_minutes:[15,240],max_chats_per_scan:[5,100],daily_call_cap:[0,2e3],lookback_days:[1,30],retention_days:[0,365]};function sl(e,t){let[n,a]=al[e];if(!Number.isFinite(t))return n;let s=Math.trunc(t);return s<n?n:s>a?a:s}function il(e,t){if(typeof t=="string"&&t.trim()==="")return"Must be a number";let n=typeof t=="number"?t:Number(t);if(!Number.isFinite(n)||!Number.isInteger(n))return"Must be a whole number";let[a,s]=al[e];return n<a||n>s?`Must be between ${a} and ${s}`:null}function ll(e,t){switch(e){case"auto":return`after each chat, plus a check every ${t} min`;case"hourly":return"about every hour";case"manual":return"only when you tap Scan";case"off":return"only when you turn updates back on and scan"}}function ul(e){switch(e){case"manual":return"Manual";case"hourly":return"Hourly";case"off":return"Paused";default:return null}}function cl(e,t){return t>0&&e>=t}function Qa(e){return Number.isFinite(e)?Math.trunc(e).toLocaleString("en-US"):"0"}function as(e,t){let n=Qa(e);return t<=0?`Today: ${n} checks used of no limit`:`Today: ${n} checks used of ${Qa(t)}`}function dl(e,t){return t<=0?0:Math.min(1,Math.max(0,e/t))}function Gr(e,t){switch(e){case"debounce_seconds":return t==="auto";case"sweep_minutes":return t==="auto"||t==="hourly";case"max_chats_per_scan":return t!=="off"}}function pl(e){return e<=0?"There is no daily limit on model calls.":`It stops after ${Qa(e)} model calls a day.`}function ss(e){return e.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase()}function gl(e){let t=ss(e.trim());return t?t.split(/\s+/).filter(Boolean):[]}function ml(e){return ss(e.filter(t=>t!=null&&t!=="").join(`
`))}function Lr(e,t,n={}){if(t.length===0)return!0;let a=n.nameAfterChat?Co(e,!0):e.topic,s=ml([a,e.topic,e.title_override??"",e.ask,e.chat_title,e.agent,e.project?.name??"",...wt(e).map(l=>l.name),e.context??"",n.groupTitle??"",n.projectName??""]);return t.every(l=>s.includes(l))}function Dp(e,t,n,a=!1){if(n.length===0)return!1;let s=Jo(e,a),l=ml([s,e.title,e.chat_title,e.agent,t??""]);return n.every(c=>l.includes(c))}function fl(e,t,n,a=!1){if(t.length===0)return e;let s=[];for(let l of e){if(l.kind==="task"){Lr(l.task,t,{nameAfterChat:a})&&s.push(l);continue}let c=n?n(l.group):Ja(l.tasks).map(w=>w.name).join(" ")||null,p=Jo(l.group,a),m=Dp(l.group,c,t,a)?l.tasks:l.tasks.filter(w=>Lr(w,t,{groupTitle:p,projectName:c,nameAfterChat:a}));m.length>0&&s.push({...l,tasks:m})}return s}function Mp(e){let t=[],n="";for(let a=0;a<e.length;a++){let s=ss(e[a]);if(s)for(let l=0;l<s.length;l++)n+=s[l],t.push(a)}return{norm:n,toOrig:t}}function wl(e,t){let n=e?.connectionId?.trim();if(!n||n==="local")return;let a=t?.trim();if(!(a&&n===a))return n}function hl(e,t,n,a){let s={session_id:e,profile:t||"default"},l=wl(n,a);return l&&(s.connection_id=l),s}function bl(e,t,n,a,s){let l={session_id:e,profile:t||"default",quadrant:s.quadrant},c=wl(n,a);return c&&(l.connection_id=c),s.ask!=null&&s.ask!==""&&(l.ask=s.ask),s.title!=null&&s.title!==""&&(l.title=s.title),l}function is(e,t){let n=t?.quadrant;if(n!=null&&n>=1&&n<=4)return n;if(e.length>0){let a=e[0].quadrant;if(a>=1&&a<=4)return a}return 2}function Mn(e,t){return e.length===1?{kind:"task",taskId:e[0].id}:{kind:"group",chatKey:t}}function yl(e){return e.map(t=>t.id)}var Ln="waiting-on-you:tasks-changed",ls="waiting-on-you:settings-changed";function us(){typeof globalThis<"u"&&"dispatchEvent"in globalThis&&globalThis.dispatchEvent(new CustomEvent(Ln))}function cs(){typeof globalThis<"u"&&"dispatchEvent"in globalThis&&globalThis.dispatchEvent(new CustomEvent(ls))}function kl(e,t){if(!e||t.length===0)return[];let{norm:n,toOrig:a}=Mp(e);if(!n)return[];let s=[];for(let c of t){if(!c)continue;let p=0;for(;p<=n.length-c.length;){let d=n.indexOf(c,p);if(d===-1)break;let m=a[d],w=a[d+c.length-1]+1;s.push([m,w]),p=d+1}}s.sort((c,p)=>c[0]-p[0]);let l=[];for(let c of s){let p=l[l.length-1];p&&c[0]<=p[1]?p[1]=Math.max(p[1],c[1]):l.push([c[0],c[1]])}return l}function xl(e,t,n){let a=e.trim(),s=n?.trim()??"";return a===s||a===t.trim()&&!n?.trim()?{action:"close"}:{action:"save",value:a||null}}function vl(e,t,n){let a=e.trim(),s=!!n.title_locked,l=s?n.title?.trim()??"":"";return a===t.trim()&&(!s||a===l)?{action:"close"}:{action:"save",value:a||null}}function tn(e,t){return e==="priority"||e==="project"||e==="none"?e:t===!1?"none":"priority"}function Ur(e){return e==="compact"||e==="focus"?e:"cards"}function Tl(e){let t=e[0]?.agent;return e.some(n=>n.agent!==t)}function Sl(e,t){let n=e==null?[t]:e.map(a=>a.entries);for(let a of n)for(let s of a){if(s.kind==="task")return{task:s.task,group:null,groupSize:1};let l=s.tasks[0];if(l)return{task:l,group:s.group,groupSize:s.tasks.length}}return null}function Cl(e){return e==="priority"?"none":"priority"}var Nl="no-project";function Lp(e){return e==null?Nl:`project:${e}`}function Op(e){if(e.kind==="task")return e.task.project??null;for(let t of e.tasks)if(t.project)return t.project;return null}function ds(e){return e.kind==="group"?e.group.chat_key:e.task.chat_key}function Pl(e,t){let n=new Map,a=[];for(let l of e){let c=Op(l);if(!c){a.push(l);continue}let p=Lp(c.key),d=n.get(p);d||(d={key:p,title:c.name,entries:[]},n.set(p,d)),d.entries.push(l)}let s=[...n.values()].sort((l,c)=>l.title.localeCompare(c.title,void 0,{sensitivity:"base"})||l.key.localeCompare(c.key));return a.length>0&&s.push({key:Nl,title:t,entries:a}),s}function $l(e,t=Gi){return Bi.map(n=>({key:String(n),title:t[n],entries:e[n]}))}function zi(e){let t=new Date(e);return t.setHours(0,0,0,0),t.getTime()}function Al(e,t){if(!Number.isFinite(e)||e<=0)return null;let n=new Date(e*1e3),a=1440*60*1e3,s=Math.round((zi(n)-zi(t))/a);if(s<0)return{label:"Overdue",tone:"overdue"};if(s===0)return{label:"Due today",tone:"today"};if(s===1)return{label:"Due tomorrow",tone:"soon"};if(s<7)return{label:`Due ${n.toLocaleDateString("en-US",{weekday:"short"})}`,tone:"soon"};let l=n.getFullYear()===t.getFullYear();return{label:`Due ${n.toLocaleDateString("en-US",{month:"short",day:"numeric",year:l?void 0:"numeric"})}`,tone:"later"}}function _l(e){let t=null;for(let n of e){let a=n.due_at;a==null||!Number.isFinite(a)||a<=0||(t==null||a<t)&&(t=a)}return t}var o={pluginName:"Waiting On You",paletteOpen:"Open Waiting On You",paletteUndo:"Waiting On You: Undo last action",paletteKeywords:["waiting","tasks","todo","quadrant","covey"],keybindUndoLabel:"Undo last Waiting On You action",keybindTogglePriorities:"Toggle Waiting On You priorities",keybindToggleProjectBadges:"Toggle Waiting On You project badges",keybindToggleAllGroups:"Expand or collapse all Waiting On You groups",keybindToggleAnswerBars:"Show Waiting On You answer buttons on every task",paletteToggleAnswerBars:"Waiting On You: Answer buttons on every task",settingsShortcutToggleAnswerBars:"Answer buttons on every task",settingsShortcutAnswerKeys:"Answer the selected task",settingsShortcutAnswerKeysHint:"Y yes \xB7 N no \xB7 R reply \xB7 L later \xB7 O open \xB7 J/K move",answerBarsAllOn:"Answer buttons on every task",answerBarsAllOff:"Answer buttons on the selected task only",answerYes:"Yes",answerNo:"No",answerReply:"Reply",answerLater:"Later",answerDone:"Done",answerYesTip:"Send \u201CYes\u201D to the agent (Y)",answerNoTip:"Send \u201CNo\u201D to the agent (N)",answerReplyTip:"Type an answer for the agent (R)",answerLaterTip:"Snooze until tomorrow 8 AM (L)",answerOpenTip:"Open the chat (O)",answerDoneTip:"Mark done without telling the agent",answerBarRegion:"Answer this task",answerReplyLabel:"Your answer",answerReplyPlaceholder:"Type your answer",answerReplySend:"Send",answerReplyCancel:"Cancel",answerReplyHint:"Enter sends \xB7 Shift+Enter new line \xB7 Esc cancels",answerWaiting:e=>`Sending \u201C${e}\u201D in a few seconds\u2026`,answerSending:e=>`Sending \u201C${e}\u201D\u2026`,answerUndo:"Undo",answerSent:(e,t)=>`Sent \u201C${e}\u201D to ${t}.`,answerUnsupported:"An inline answer isn\u2019t available for this chat. Open it and answer there.",answerNotSent:e=>`Couldn\u2019t send your answer to ${e}. Nothing was sent, and the ask is still open.`,answerGone:e=>`${e} was already closed, so your answer wasn\u2019t sent.`,answerCancelled:"Answer not sent.",answerAlreadyPending:"That ask already has an answer on the way.",keybindScan:"Scan Waiting On You now",keybindOpen:"Show or hide Waiting On You",paletteTogglePanel:"Waiting On You: Show or hide panel",paneHiddenNotify:"Waiting On You hidden. Press \u2318\u2325Y to show it.",statusBarHidePane:"Hide Waiting On You (\u2318\u2325Y)",statusBarShowPane:"Show Waiting On You (\u2318\u2325Y)",hidePaneHeader:"Hide panel (\u2318\u2325Y)",prioritiesOn:"Priorities on",prioritiesOff:"Priorities off",groupedByNone:"No grouping",projectBadgesOn:"Project badges on",projectBadgesOff:"Project badges off",paletteTogglePriorities:"Waiting On You: Toggle priorities",paletteToggleProjectBadges:"Waiting On You: Toggle project badges",paletteToggleAllGroups:"Waiting On You: Expand or collapse all groups",paletteScan:"Waiting On You: Scan now",paletteGroupByProject:"Waiting On You: Group by project",groupedByProject:"Grouped by project",groupedByPriority:"Grouped by priority",updatedPrefix:"Updated",presenceGroupAria:"Chat activity",presenceWorking:"Working",presenceWorkingAria:e=>`${e} is working on a reply in this session`,presenceResponded:"Responded",presenceRespondedAria:e=>`${e} has started a reply in this session`,presenceRespondedUnavailable:"Responded unknown",presenceRespondedUnavailableAria:"Responded status is not available through the public plugin API on this host",presenceReadUnavailable:"Read unknown",presenceReadUnavailableAria:"Read status is not available through the public plugin API on this host",scanNow:"Scan now",scanning:"Scanning\u2026",scanningHint:"Reading your chats\u2026",scanDone:(e,t,n=0)=>`Scan done: ${e} new, ${t} resolved${n?`, ${n} cleared for age`:""}`,scanModelUnreachable:"Couldn\u2019t reach your Hermes model, so no chats were checked. Make sure Hermes can chat, then press Scan now.",scanSomeChatsFailed:e=>`Some chats couldn\u2019t be checked: ${e}`,scanLocked:"A scan is already running. Try again when it finishes.",scanRateLimited:"A scan just ran. Try again in a few seconds.",scanFailed:"Scan failed. Try again.",scanCapped:"Daily limit reached.",scanAnyway:"Scan anyway",scanTryAgain:"Try again",scanUpdatesOff:"Updates are off. Turn them on in settings.",headerDailyLimit:"Daily limit reached",storageLabelWarning:(e,t,n)=>`Can't read ${t} recent ${t===1?"chat":"chats"}${e?` from ${e}`:""}. Hermes now saves ${t===1?"it":"them"} under a new label ("${n}"). Update Waiting On You.`,machineOfflineCached:(e,t)=>`${e} can't be reached. Showing its chats from ${t}; new asks there are missed.`,machineOfflineNoCache:e=>`${e} can't be reached, so its chats are not on this list.`,firstRunLine1:"Finds what your AI agents are waiting on you for, and keeps it as a task list.",firstRunLine2:e=>`To do that, it sends the end of each changed chat to ${e}.`,firstRunLine3:(e,t,n)=>`It checks ${e}. ${t} It starts by looking back ${n} days.`,firstRunStart:"Start",firstRunChangeSettings:"Change settings first",settingsBack:"\u2039 Back",settingsTaskTitlesSection:"Task titles & chats",settingsFrequencySection:"How often it checks",settingsUsageSection:"Usage",settingsAdvanced:"Advanced",settingsModeAutoTitle:"Automatic (recommended)",settingsModeAutoDesc:e=>`After each chat reply, plus a check every ${e} minutes.`,settingsModeHourlyTitle:"Every hour",settingsModeHourlyDesc:"One check an hour.",settingsModeManualTitle:"Only when I press refresh",settingsModeManualDesc:"Nothing runs on its own.",settingsModeOffTitle:"Paused",settingsModeOffDesc:"Stops checking. Your list stays as it is.",settingsUsageModel:e=>`Uses ${e}.`,settingsUpdates:"Updates",settingsCost:"Cost",settingsChats:"Chats",settingsBehavior:"Behavior",settingsMode:"Mode",modeAuto:e=>`Auto: After each chat, plus a check every ${e} min`,modeHourly:"Hourly",modeManual:"Manual only",modeOff:"Off",settingsSweep:"Check every (minutes)",settingsDebounce:"Wait after a reply before checking (seconds)",settingsMaxChats:"Most chats per check",settingsModel:"Model",settingsModelHint:"To change it, set auxiliary.waiting_on_you in Hermes config.",settingsDailyCap:"Daily check limit",settingsDailyCapHint:"0 means no limit. Checks you start yourself (Scan anyway, name with AI) can go past it.",settingsUsageOver:e=>e>0?`Over the limit because you started ${e} ${e===1?"check":"checks"} yourself. Background checks stop at the limit.`:"Checks you start yourself can go past the limit. Background checks stop at it.",settingsUsageHistory:"Past 7 days",settingsLookback:"How far back to look (days)",settingsRetention:"Keep unanswered tasks for (days)",settingsRetentionHint:"0 = Forever (the default). Expiry is opt-in: inactive tasks are cleared for age, not marked answered. Future snoozes, future due dates, manual tasks, and locked priorities are protected.",whyHere:"Why is this here?",listEmpty:"Nothing is waiting on you.",listEmptyScan:e=>`Last scan ${e}.`,section1:"Urgent & Important",section2:"Important & Not Urgent",section3:"Urgent & Not Important",section4:"Not Urgent & Not Important",quadrantBar1:"Urgent & Important",quadrantBar2:"Important & Not Urgent",quadrantBar3:"Urgent & Not Important",quadrantBar4:"Not Urgent & Not Important",sortNewest:"Newest first",sortOldest:"Oldest first",sortLabel:"Sort",settings:"Settings",settingsLoading:"Loading settings\u2026",settingsLoadError:"Could not load settings.",projectsLoadError:"Could not load Hermes projects.",retry:"Retry",settingsShortcutsSection:"Keyboard shortcuts",settingsShortcutsFooter:"Change these in Desktop keyboard settings.",settingsShortcutOpen:"Show or hide panel",settingsShortcutUndo:"Undo",settingsShortcutTogglePriorities:"Toggle priorities",settingsShortcutToggleProjectBadges:"Toggle project badges",settingsShortcutToggleAllGroups:"Expand or collapse all groups",settingsShortcutScan:"Scan now",settingsShortcutCollapseGroups:"Collapse or expand all groups",settingsShortcutCollapseGroupsHint:"\u2325 + click triangle",archiveChatOnDone:"Archive the chat when its last task is done",archiveChatHelp:"The chat leaves your chat list. Undo or Reopen brings it back.",agentFilterAll:"All agents",agentFilterLabel:"Agent",clearFilters:"Clear",openSession:"Open session",handleWithAgent:e=>`Handle with ${e}`,actionRunningSuffix:"\u2026",nameAfterChat:"Name tasks after their chat",nameAfterChatHelp:"Use the chat's name as the task title. Tasks you renamed keep your name.",groupByLabel:"Group tasks by",groupByHelp:"Priority uses the four Urgent & Important sections. Project uses your Hermes projects.",groupByPriority:"Priority",groupByProject:"Project",groupByNone:"None",filtersButton:"Filter and sort",filtersButtonActive:"Filter and sort (filters on)",filtersSummary:"Showing",layoutLabel:"Layout",layoutHelp:"Cards keep each chat in its own box. Compact fits more on screen. Next up shows the one thing to do first.",layoutCards:"Cards",layoutCompact:"Compact",layoutFocus:"Next up",nextUpKicker:"Next up",nextUpDone:"Done",nextUpLater:"Later",nextUpLaterTip:"Snooze until tomorrow 8 AM",nextUpRegion:"Next task to handle",askShowDetails:"Show details",askHideDetails:"Hide details",followSelectedChat:"Follow selected chat",followSelectedChatHelp:"Center and highlight the card for the chat you select in the sidebar.",showProjectBadges:"Show project badges",showProjectBadgesHelp:"Show the Hermes project on each task card. Click one to see only that project.",projectFilterLabel:"Project",projectFilterAll:"All projects",projectFilterNone:"No project",projectFilterMany:e=>`${e} projects`,projectFilterEmpty:"No Hermes projects yet.",projectBadgeTip:e=>`Show only ${e}`,sectionNoProject:"No project",renameKeyboardHint:"Enter to save \xB7 Esc to cancel",tagFilterLabel:"Tag",tagFilterAll:"All tags",tagFilterMany:e=>`${e} tags`,tagFilterHint:"Shows tasks that have every tag you pick.",tagFilterEmpty:"No tags yet. Add them in Settings.",tagsSection:"Tags",tagsIntro:"Your own labels for tasks. Add or remove them from a card\u2019s \u22EF menu.",tagsEmpty:"No tags yet.",tagAdd:"Add tag",tagNew:"New tag\u2026",tagNewTitle:"New tag",tagNewDescription:"Pick a name and a color.",tagNewDescriptionApply:"Pick a name and a color. It goes on this task too.",tagName:"Name",tagNamePlaceholder:"e.g. Waiting on reply",tagColor:"Color",tagCreate:"Create",tagCreated:"Tag created",tagRename:e=>`Rename ${e}`,tagChangeColor:e=>`Change color of ${e}`,tagHintLabel:"Helps the AI pick this tag",tagHintPlaceholder:"Optional",tagOpenCount:e=>`${e} open`,tagDelete:"Delete",tagDeleteConfirm:e=>`Delete the tag \u201C${e}\u201D? It comes off every task.`,tagNameInvalid:"Use 1 to 32 characters.",tagSaveError:"Could not save the tag.",tagAddedByAi:"Added by AI",tagMoreTitle:e=>`Also: ${e}`,tagColorName:e=>e.charAt(0).toUpperCase()+e.slice(1),autoTag:"Let AI add your tags",autoTagHelp:"Uses only tags you made. If you remove one, it stays off that task.",menuSectionTags:"Tags",undoTags:"Tags changed.",undoGroupTags:"Tags changed for all.",dueOverdueTip:"Past its due date",pendingDoneChatArchived:"Done \xB7 chat archived",sectionEmpty:"Nothing here.",pendingDone:"Done",pendingDismissed:"Dismissed",markDone:e=>`Mark done: ${e}`,markGroupDone:e=>`Mark all done: ${e}`,markAllDone:e=>`Mark all ${e} done?`,markAllDoneYes:e=>`Mark all ${e} done`,closeAllTasks:"Close all tasks",groupOptionClickHint:"Tip: Option-click the checkbox to close every task at once.",groupCheckboxTip:"Click to close all tasks \xB7 Option-click to skip the question",dismissTip:"Dismiss tip",yes:"Yes",no:"No",groupExpand:"Show tasks in group",groupChevronTip:"Option-click to collapse or expand all",groupCollapse:"Hide tasks in group",groupAsksCount:e=>e===1?"1 ask":`${e} asks`,menuMoreForAsk:e=>`More actions for ${e}`,notATaskAll:"Remove all \u2014 not real tasks",snoozeAllTomorrow:"Snooze all: Tomorrow 8 AM",snoozeAllMonday:"Snooze all: Next Monday 8 AM",snoozeAllWeek:"Snooze all: In 1 week",snoozeAllCustom:"Snooze all: Pick date and time\u2026",rename:"Rename",renameSave:"Save",renameCancel:"Cancel",renameWithAi:"Rename with AI",renameWithAiBusy:"Naming\u2026",renameWithAiPending:"Naming with AI\u2026",renameWithAiFailed:"Could not name it with AI.",renameWithAiSame:"AI picked the same name.",renameWithAiTip:"Write a name from this chat. Tip: hold \u2325 in the \u22EF menu to rename in one click.",renameAltHint:"\u2325",renameLabel:"Name",menuSectionSnooze:"Snooze",menuSectionPriority:"Priority",snoozeTomorrowShort:"Tomorrow 8 AM",snoozeMondayShort:"Next Monday",snoozeWeekShort:"In one week",snoozeCustomShort:"Custom\u2026",undoRename:"Name changed.",undoGroupDone:"Marked all done.",undoGroupDismissed:"Dismissed all.",undoGroupSnoozed:"Snoozed all.",undoGroupMoved:"Moved group.",notATask:"Remove \u2014 not a real task",snoozeTomorrow:"Snooze: Tomorrow 8 AM",snoozeMonday:"Snooze: Next Monday 8 AM",snoozeWeek:"Snooze: In 1 week",snoozeCustom:"Snooze: Pick date and time\u2026",snoozeSubmit:"Snooze",snoozeCancel:"Cancel",snoozePast:"Pick a time in the future.",moveToQuadrant:e=>`Move to: ${e}`,menuMore:"More actions",undoDone:"Marked done.",undoDismissed:"Dismissed.",undoSnoozed:"Snoozed.",undoMoved:"Moved.",undoMore:e=>`(${e} more)`,undo:"Undo",chatCopied:"Chat title copied. Open it with \u2318K.",chatContextReady:"New chat ready. Check the text, then send.",chatNewDraftBlocked:"Your new chat already has a draft, so it was left alone. Send or clear it, then try again.",chatOpenFailed:(e,t)=>`Could not open \u201C${e}\u201D: ${t}`,showClosed:"Show closed",hideClosed:"Hide closed",closedNote:"Done and dismissed items stay closed. Age-cleared tasks can return if asked again.",reopen:"Reopen",statusExpired:"Cleared for age \xB7 not answered",statusDone:"done",statusDismissed:"dismissed",quadrant1Badge:e=>e===1?"1 Urgent & Important":`${e} Urgent & Important`,loadError:"Could not load tasks.",notOnThisProfile:"Waiting On You isn't installed on this profile.",offline:"Can't reach Hermes. Retrying\u2026",patchError:"Could not update task.",alreadyCleared:"Already cleared",searchOpen:"Search (\u2318F)",searchPlaceholder:"Search tasks, chats, projects, tags\u2026",searchAria:"Search tasks",searchIncludeClosed:"Include closed",searchClose:"Close search",searchFilteredPrefix:"Filtered:",searchNoMatch:e=>`No tasks match \u201C${e}\u201D.`,searchClear:"Clear search",searchClosedSection:"Closed",composerButton:"Waiting On You",composerButtonTracked:e=>e===1?"Waiting On You (1 item)":`Waiting On You (${e} items)`,composerAddTitle:"Add to Waiting On You",composerTrackedTitle:"In Waiting On You",composerAddDescription:"Track this chat and choose where it goes.",composerAskLabel:"What's waiting on you?",composerClose:"Close",composerAskPlaceholder:"Follow up on this chat",composerAddAnother:"Add another item",composerMarkComplete:"Mark complete",composerAdded:"Added to Waiting On You",composerCompleted:"Marked complete",composerSnoozed:"snoozed",composerCancel:"Cancel",composerUntitled:"Untitled",composerAdd:"Add",composerQuadrantLabel:"Priority",teachTitle:"Teach priorities",paletteTeach:"Waiting On You: Teach priorities",teachIntro:"Sort a few tasks by hand. Your answers guide how new tasks are sorted.",teachProgress:(e,t)=>`Task ${e} of ${t}`,teachFiledAs:e=>`Filed as: ${e}`,teachQuadrant1:"Urgent and important",teachQuadrant1Hint:"Do it now",teachQuadrant2:"Important, not urgent",teachQuadrant2Hint:"Plan time for it",teachQuadrant3:"Urgent, not important",teachQuadrant3Hint:"Quick, or hand it off",teachQuadrant4:"Not urgent or important",teachQuadrant4Hint:"It can wait",teachSkip:"Skip",teachDone:"Done",teachKeysHint:"Keys: 1\u20134 to answer, S to skip.",teachLoading:"Loading tasks\u2026",teachLoadError:"Could not load tasks to sort.",teachSaveError:"Could not save that answer.",teachSaveRetry:"Pick again to retry.",teachFinished:e=>`Done. ${e} ${e===1?"task":"tasks"} sorted. Your answers now guide new tasks.`,teachFinishedNone:"Done. Nothing was sorted this time.",teachMore:"Do 10 more",teachEmpty:"Nothing left to sort. New tasks show up here after a scan.",teachEmptyNote:"Tasks you already moved yourself are not asked again.",prioritiesNoteSection:"What matters to you",prioritiesNoteLabel:"What matters to you",prioritiesNoteHelp:"Used when sorting new tasks. Example: Clients and family first. Content deadlines matter; tool tweaks can wait.",prioritiesNotePlaceholder:"Clients and family first\u2026",prioritiesNoteTooLong:"Keep it under 1,000 characters.",charCount:(e,t)=>`${e.toLocaleString("en-US")} / ${t.toLocaleString("en-US")}`,teachFromSettings:"Teach priorities\u2026",teachFromSettingsHelp:"Sort 10 tasks by hand so it learns how you rank things.",decisionSection:"Decision model (optional)",decisionIntro:"A small, fast model that answers yes/no and rating questions. Waiting On You can use one to skip chats with nothing waiting, rate priority, and add tags. Your main Hermes model still writes the tasks.",decisionProvider:"Provider",decisionProviderOff:"Off",decisionModel:"Model",decisionBaseUrl:"Base URL",decisionAccountId:"Account ID",decisionKeySaved:"Key: saved",decisionKeyNotSet:"Key: not set",decisionKeyPath:"Hermes Settings \u203A Plugins \u203A Waiting On You (or the gear next to it in Capabilities \u203A Plugins)",decisionKeyWhere:(e,t)=>t?`Add the key (${t}) in ${e}.`:`Add the key in ${e}.`,decisionNative:"Hermes has a built-in decision model; it will be used.",decisionTest:"Test",decisionTesting:"Testing\u2026",decisionTestOk:e=>`Works \u2014 ${e} ms`,decisionTestOkNoTime:"Works",decisionErr401:"The key was rejected.",decisionErr429:"Rate limited. Try again in a minute.",decisionErrTimeout:"No answer in time.",decisionErrNotConfigured:"Pick a provider and add its key first.",decisionTestFailed:e=>`Test failed (${e}).`,decisionTestFailedPlain:"Test failed.",decisionLoadError:"Could not load the decision model settings.",decisionSaveError:"Could not save the decision model.",decisionLastError:e=>`Last problem: ${e}`,decisionUsageToday:(e,t)=>`Today: ${e.toLocaleString("en-US")} ${e===1?"call":"calls"} \xB7 ${t.toLocaleString("en-US")} input tokens`,decisionGate:"Skip chats with nothing waiting",decisionGateHelp:"Asks the decision model first, so your main model only reads chats that need you.",decisionPriority:"Rate priority with the decision model",decisionPriorityHelp:"Rates how urgent and important each new task is.",decisionNeedsModel:"These only run when a decision model is set.",autoTagDecisionNote:"Uses the decision model when one is set.",tagSuggest:"Suggest tags",tagSuggesting:"Looking at your chats\u2026",tagSuggestNote:"Uses one AI call. Nothing is saved until you add it.",tagSuggestEmpty:"No new tag ideas. You may already have them.",tagSuggestError:"Could not suggest tags.",tagSuggestAdd:"Add",tagSuggestAdded:"Added",tagSuggestSkip:"Skip",tagSuggestAddAll:"Add all",tagSuggestExamples:e=>e===1?"1 recent task":`${e} recent tasks`,tagSuggestTaken:"You already have a tag with that name.",tagSuggestRename:e=>`Name for suggested tag ${e}`,firstRunStepOf:(e,t)=>`Optional step ${e} of ${t}`,firstRunDecisionTitle:"Pick a decision model (optional)",firstRunTagsTitle:"Suggest tags from your recent chats",firstRunTagsIntro:"Get a few tag ideas from your recent tasks. Add the ones you like.",teachCardTitle:"Teach priorities",teachCardIntro:"Sort 10 tasks by hand so new ones land in the right place. About 2 minutes.",teachCardStart:"Start",teachCardNotNow:"Not now",teachCardDismiss:"Dismiss",firstRunTeachEmpty:"No tasks to sort yet. We\u2019ll offer this again after a few scans.",firstRunTeachTitle:"Teach priorities now?",firstRunTeachIntro:"Sort 10 tasks by hand so new ones land in the right place. You can do this later from Settings.",firstRunTeachWait:"The first scan is still running. Tasks to sort show up when it finishes.",firstRunNext:"Next",firstRunSkip:"Skip for now",firstRunTeachNow:"Teach priorities now",firstRunLater:"Later",firstRunFinish:"Finish"};var Kr=10,ps=1e3;function Fp(e){return e===1||e===2||e===3||e===4}function El(e){let t=e?.tasks;if(!Array.isArray(t))return[];let n=[];for(let a of t){let s=a;typeof s?.id!="number"||typeof s.ask!="string"||n.push({id:s.id,ask:s.ask,context:typeof s.context=="string"&&s.context.trim()?s.context:null,chat_title:typeof s.chat_title=="string"?s.chat_title:"",agent:typeof s.agent=="string"?s.agent:"",project:typeof s.project=="string"&&s.project?s.project:null,quadrant:Fp(s.quadrant)?s.quadrant:4,due_at:typeof s.due_at=="number"?s.due_at:null})}return n}var gs={status:"loading",items:[],index:0,sorted:0,busy:!1,error:null,moreAvailable:null};function Rl(e,t){let n=e.sorted+(t?1:0),a=e.index+1;return a>=e.items.length?{...e,index:a,sorted:n,busy:!1,error:null,status:"done",moreAvailable:null}:{...e,index:a,sorted:n,busy:!1,error:null}}function Il(e,t){switch(t.type){case"load":return{...e,status:"loading",busy:!1,error:null};case"loaded":return t.items.length===0?e.sorted>0?{...e,status:"done",items:[],index:0,busy:!1,error:null,moreAvailable:!1}:{...gs,status:"empty"}:{...e,status:"ready",items:t.items,index:0,busy:!1,error:null,moreAvailable:null};case"loadFailed":return{...e,status:"error",busy:!1,error:t.error};case"submit":return e.status!=="ready"||e.busy?e:{...e,busy:!0,error:null};case"answered":return e.status==="ready"?Rl(e,!0):e;case"skipped":case"gone":return e.status==="ready"?Rl(e,!1):e;case"submitFailed":return{...e,busy:!1,error:t.error};case"more":return e.status==="done"?{...e,moreAvailable:t.available}:e;default:return e}}function Dl(e){return e.status!=="ready"?null:e.items[e.index]??null}function Ml(e){return o.teachProgress(Math.min(e.index+1,e.items.length),e.items.length)}var ms=[{quadrant:1,label:o.teachQuadrant1,hint:o.teachQuadrant1Hint},{quadrant:2,label:o.teachQuadrant2,hint:o.teachQuadrant2Hint},{quadrant:3,label:o.teachQuadrant3,hint:o.teachQuadrant3Hint},{quadrant:4,label:o.teachQuadrant4,hint:o.teachQuadrant4Hint}];function jp(e){return ms.find(t=>t.quadrant===e)?.label??o.teachQuadrant4}function Ll(e){return o.teachFiledAs(jp(e))}function Ol(e){return e.metaKey||e.ctrlKey||e.altKey?null:e.key==="1"||e.key==="2"||e.key==="3"||e.key==="4"?Number(e.key):e.key==="s"||e.key==="S"?"skip":null}function Fl(e){return[e.chat_title,e.agent,e.project].map(t=>(t??"").trim()).filter(Boolean).join(" \xB7 ")}function jl(e){return e.ok?e.latency_ms!=null&&Number.isFinite(e.latency_ms)?o.decisionTestOk(Math.round(e.latency_ms)):o.decisionTestOkNoTime:zp(e.code)}function zp(e){switch(e){case"http_401":case"http_403":return o.decisionErr401;case"http_429":return o.decisionErr429;case"timeout":return o.decisionErrTimeout;case"not_configured":return o.decisionErrNotConfigured;case null:case void 0:case"":return o.decisionTestFailedPlain;default:return o.decisionTestFailed(e)}}function fs(e,t){let n=[...e].length;return{label:o.charCount(n,t),over:n>t,near:n>=Math.floor(t*.9)}}function on(e){return e.trim().toLocaleLowerCase()}function zl(e){let t=e?.suggestions;if(!Array.isArray(t))return[];let n=[];for(let a of t){let s=a;typeof s?.name!="string"||!s.name.trim()||n.push({name:s.name.trim().slice(0,32),color:In(typeof s.color=="string"?s.color:null),hint:typeof s.hint=="string"?s.hint.trim().slice(0,200):"",example_count:typeof s.example_count=="number"?s.example_count:0})}return n}function Bl(e,t){let n=new Set;for(let s of t)n.add(on(s));let a=[];for(let s of e){let l=on(s.name);!l||n.has(l)||(n.add(l),a.push({key:`${a.length}:${l}`,...s,status:"pending",error:null}))}return a}function ws(e){let t=e.trim().length;return t<1||t>32?o.tagNameInvalid:null}function Hl(e,t,n){return e.map(a=>a.key===t?{...a,name:n,error:null}:a)}function No(e,t,n,a=null){return e.map(s=>s.key===t?{...s,status:n,error:a}:s)}function Gl(e,t){let n=new Set;for(let s of t)n.add(on(s));let a=[];for(let s of e){if(s.status!=="pending"||ws(s.name))continue;let l=on(s.name);n.has(l)||(n.add(l),a.push(s))}return a}function Ul(e,t){let n=on(e.name);for(let a of t)if(on(a)===n)return!0;return!1}function Kl(e){return e.filter(t=>t.status==="pending"||t.status==="adding").length}async function Wr(e,t=!1){let n=t?"/tasks?include_closed=1":"/tasks";return e.rest(n)}async function Ot(e,t,n){let a=encodeURIComponent(t);return e.rest(`/groups/${a}`,{method:"PATCH",body:n})}async function Wl(e,t){return(await e.rest("/ai-title",{method:"POST",body:t,timeoutMs:6e4})).title}async function Ql(e,t,n){return e.rest(`/tasks/${t}/actions/${n}`,{method:"POST",timeoutMs:12e4})}async function Ft(e,t,n){return e.rest(`/tasks/${t}`,{method:"PATCH",body:n})}async function ql(e){let t=await e.rest("/projects");return{projects:Array.isArray(t.projects)?t.projects:[],no_project_count:typeof t.no_project_count=="number"?t.no_project_count:0}}async function Vl(e){let t=await e.rest("/tags");return Array.isArray(t.tags)?t.tags:[]}async function hs(e,t){return(await e.rest("/tags",{method:"POST",body:t})).tag}async function Yl(e,t,n){return(await e.rest(`/tags/${t}`,{method:"PATCH",body:n})).tag}async function Xl(e,t){await e.rest(`/tags/${t}`,{method:"DELETE"})}async function bs(e,t,n){let a={};return n.add&&n.add.length>0&&(a.add=n.add),n.remove&&n.remove.length>0&&(a.remove=n.remove),(await e.rest(`/tasks/${t}/tags`,{method:"POST",body:a})).task}async function Po(e){return e.rest("/settings")}async function $o(e,t){let n=await e.rest("/settings",{method:"PATCH",body:t});return cs(),n}async function Zl(e,t){let n=t?.force?{force:!0}:{};return e.rest("/scan",{method:"POST",body:n,timeoutMs:18e4})}async function On(e,t=Kr){let n=await e.rest(`/quiz?limit=${t}`);return El(n)}async function Jl(e,t,n){await e.rest(`/quiz/${t}`,{method:"POST",body:{quadrant:n}})}async function eu(e,t){await e.rest(`/quiz/${t}/skip`,{method:"POST",body:{}})}function tu(e){let t=e??{};return{provider:typeof t.provider=="string"?t.provider:"",model:typeof t.model=="string"?t.model:"",base_url:typeof t.base_url=="string"?t.base_url:"",cloudflare_account_id:typeof t.cloudflare_account_id=="string"?t.cloudflare_account_id:"",key_set:!!t.key_set,key_name:typeof t.key_name=="string"&&t.key_name?t.key_name:null,native_available:!!t.native_available,providers:Array.isArray(t.providers)?t.providers:[],usage_today:{calls:typeof t.usage_today?.calls=="number"?t.usage_today.calls:0,input_tokens:typeof t.usage_today?.input_tokens=="number"?t.usage_today.input_tokens:0},last_error:typeof t.last_error=="string"&&t.last_error?t.last_error:null}}async function ou(e){return tu(await e.rest("/decision"))}async function nu(e,t){let n=await e.rest("/decision",{method:"PATCH",body:t});return cs(),tu(n)}async function ru(e){let t=await e.rest("/decision/test",{method:"POST",body:{},timeoutMs:6e4});return{ok:!!t?.ok,code:typeof t?.code=="string"?t.code:null,latency_ms:typeof t?.latency_ms=="number"?t.latency_ms:null,model:typeof t?.model=="string"?t.model:null}}async function au(e,t){let n=await e.rest("/tags/suggest",{method:"POST",body:t?{limit:t}:{},timeoutMs:9e4});return zl(n)}function Qr(e){return tn(e.group_by,e.show_priorities)}import{jsx as oe,jsxs as ht}from"react/jsx-runtime";function qr({className:e}){return oe("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:oe("path",{d:"M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 3.5V7h-3.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})}function su({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("circle",{cx:"7",cy:"7",r:"4.25",stroke:"currentColor",strokeWidth:"1.5"}),oe("path",{d:"M10.2 10.2 13.5 13.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function Vr({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("rect",{x:"2",y:"2",width:"12",height:"12",rx:"3",stroke:"currentColor",strokeWidth:"1.5"}),oe("path",{d:"M5 8.2 7.1 10.3 11 5.8",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"})]})}function iu({className:e}){return oe("svg",{className:e,width:"14",height:"14",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:oe("path",{d:"M11.5 2.5a1.8 1.8 0 0 1 2.5 2.5l-8 8-3.2.7.7-3.2 8-8Z",stroke:"currentColor",strokeWidth:"1.4",strokeLinejoin:"round"})})}function Fn({className:e}){return ht("svg",{className:e,width:"12",height:"12",viewBox:"0 0 12 12",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("path",{d:"M4.5 2.5H9.5V7.5M9.5 2.5L2.5 9.5",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),oe("rect",{x:"2.5",y:"2.5",width:"7",height:"7",rx:"1",stroke:"currentColor",strokeWidth:"1.25"})]})}function lu({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("circle",{cx:"8",cy:"8",r:"3",stroke:"currentColor",strokeWidth:"1.5"}),oe("path",{d:"M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function uu({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("rect",{x:"2.5",y:"3.5",width:"11",height:"10",rx:"1.5",stroke:"currentColor",strokeWidth:"1.5"}),oe("path",{d:"M2.5 6.5h11M5.5 2v2M10.5 2v2",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function cu({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("rect",{x:"2.5",y:"3.5",width:"11",height:"10",rx:"1.5",stroke:"currentColor",strokeWidth:"1.5"}),oe("path",{d:"M2.5 6.5h11M5.5 2v2M10.5 2v2",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),oe("path",{d:"M8 9v3M6.5 10.5h3",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function du({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("circle",{cx:"8",cy:"8",r:"5.5",stroke:"currentColor",strokeWidth:"1.5"}),oe("path",{d:"M8 5v3.2l2 1.3",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]})}function pu({className:e}){return oe("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:oe("path",{d:"M8 4v8M4 8h8",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})})}function gu({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("circle",{cx:"8",cy:"8",r:"5.5",stroke:"currentColor",strokeWidth:"1.5"}),oe("path",{d:"M8 7.2V11M8 5.5h.01",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function mu({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("path",{d:"M3.5 5.5h9M6 5.5V4.5h4v1",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),oe("path",{d:"M5 5.5l.5 7h5l.5-7",stroke:"currentColor",strokeWidth:"1.5",strokeLinejoin:"round"})]})}function nn({className:e}){return oe("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:oe("path",{d:"M4 8.2 6.8 11 12 5.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})}function fu({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("path",{d:"M2.5 8c1.8-2.8 4.2-4.2 5.5-4.2s3.7 1.4 5.5 4.2c-1.8 2.8-4.2 4.2-5.5 4.2S4.3 10.8 2.5 8Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinejoin:"round"}),oe("path",{d:"M8 9.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z",fill:"currentColor"}),oe("path",{d:"M3 3l10 10",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function wu({className:e}){return ht("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("path",{d:"M2.5 4.5h11M2.5 8h11M2.5 11.5h11",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),oe("circle",{cx:"5.5",cy:"4.5",r:"1.25",stroke:"currentColor",strokeWidth:"1.25"}),oe("circle",{cx:"10.5",cy:"8",r:"1.25",stroke:"currentColor",strokeWidth:"1.25"}),oe("circle",{cx:"6.5",cy:"11.5",r:"1.25",stroke:"currentColor",strokeWidth:"1.25"})]})}function hu({className:e}){return oe("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:oe("path",{d:"M2.5 3.5h11l-4.25 5v4l-2.5 1v-5l-4.25-5z",stroke:"currentColor",strokeWidth:"1.4",strokeLinejoin:"round"})})}function uo({className:e}){return ht("svg",{className:e,width:"14",height:"14",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[oe("path",{d:"M7 2.5 8.1 5.9 11.5 7 8.1 8.1 7 11.5 5.9 8.1 2.5 7 5.9 5.9Z",stroke:"currentColor",strokeWidth:"1.3",strokeLinejoin:"round"}),oe("path",{d:"M12.5 10.5v3M11 12h3",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})]})}function Yr(e){return typeof e=="string"?e:""}function Ae(e){let t=e??{},n=typeof t.status=="number"?t.status:typeof t.statusCode=="number"?t.statusCode:0,a=Yr(t.body?.error)||Yr(t.body?.detail),s=typeof t.message=="string"?t.message:"",l=/(\d{3}): (.*)$/s.exec(s);if(l&&(n||(n=Number(l[1])),!a))try{let c=JSON.parse(l[2]);a=Yr(c.error)||Yr(c.detail)}catch{}return{status:n,error:a||s}}function rn(e){let{status:t,error:n}=Ae(e);return t===404&&/^(task|group) not found$/i.test(n.trim())}function ys(e){let{status:t,error:n}=Ae(e);return t===404&&/plugin not found/i.test(n)}async function Xr(e,t,n,a,s){let l=hl(t,n,a,s),c=new URLSearchParams(l).toString();try{return{kind:"ok",data:await e.rest(`/session-tasks?${c}`)}}catch(p){let{status:d,error:m}=Ae(p);if(d===404)return{kind:"not_found",error:m||"Not found"};throw p}}async function bu(e,t,n,a,s,l){let c=bl(t,n,a,s,l),p=await e.rest("/tasks",{method:"POST",body:c});return us(),p.task}function jn(){us()}var Zr=!0,xs=new Set;function Ke(){return Zr}function zn(e){if(Zr!==e){Zr=e;for(let t of xs)t()}}function Zt(e){return xs.add(e),()=>xs.delete(e)}function an(){let e=Zr;return zn(!1),e}function co(e){return ys(e)}function yu(e,t){let n=e.map(a=>a&&typeof a.subscribe=="function"?a.subscribe(t):()=>{});return()=>{for(let a of n)a()}}var ks=0;async function ku(e){let t=++ks;try{if(await e("/settings",{timeoutMs:8e3}),t!==ks)return;zn(!0)}catch(n){if(t!==ks)return;ys(n)&&zn(!1)}}var r="wou-root",xu=`
.${r} {
  --wou-fg: var(--dt-foreground, var(--foreground, #111));
  --wou-border: var(--dt-border, var(--border, #ddd));
  --wou-accent: var(--ui-accent, var(--accent, #2563eb));
  --wou-card: var(--dt-card, var(--card, #f8f8f8));
  color: var(--wou-fg);
  box-sizing: border-box;
}
.${r} *, .${r} *::before, .${r} *::after { box-sizing: inherit; }
.${r} .wou-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  color: var(--wou-fg);
  flex-shrink: 0;
  font: inherit;
  cursor: pointer;
}
.${r} .wou-icon-btn svg {
  display: block;
  width: 16px;
  height: 16px;
}
.${r} .wou-composer-trigger { position: relative; }
/* The trigger is itself the .wou-root element, so it needs a compound rule.
   Desktop leaves only a 4px gap before the model pill, whose text has no left
   padding; add our own space so the icon doesn't crowd the model name. */
.${r}.wou-composer-trigger {
  position: relative;
  margin-inline-end: 8px;
}
.${r} .wou-composer-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wou-accent);
  pointer-events: none;
}
`,Ao=`
:root.dark .${r} { color-scheme: dark; }
.${r} {
  --wou-fg: var(--dt-foreground, var(--foreground, #111));
  --wou-muted: var(--dt-muted-foreground, var(--muted-foreground, #666));
  --wou-border: var(--dt-border, var(--border, #ddd));
  --wou-accent: var(--ui-accent, var(--accent, #2563eb));
  --wou-card: var(--dt-card, var(--card, #f8f8f8));
  color: var(--wou-fg);
  font: 13px/1.45 system-ui, sans-serif;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
}
.${r}.wou-dialog {
  height: auto;
  min-height: 0;
  width: min(440px, calc(100vw - 32px));
  max-height: min(80vh, 620px);
  overflow-y: auto;
}
.${r} *, .${r} *::before, .${r} *::after { box-sizing: inherit; }
.${r} button {
  font: inherit;
  cursor: pointer;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  color: var(--wou-fg);
  border-radius: 6px;
  padding: 4px 10px;
}
.${r} button:disabled { opacity: 0.5; cursor: default; }
.${r} button.wou-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--wou-accent);
  text-align: left;
}
.${r} button.wou-icon {
  padding: 2px 6px;
  min-width: 28px;
}
.${r} input[type="checkbox"] { accent-color: var(--wou-accent); }
.${r} .wou-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--wou-border);
}
.${r} .wou-header-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow-x: hidden;
}
.${r} .wou-header-row2 {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.${r} .wou-header-updated {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1 1 auto;
}
.${r} .wou-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}
.${r} .wou-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  color: var(--wou-fg);
  flex-shrink: 0;
}
.${r} .wou-icon-btn svg {
  display: block;
  width: 16px;
  height: 16px;
}
.${r} .wou-icon-spin {
  animation: wou-spin 0.8s linear infinite;
}
.${r} .wou-select {
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;
  font: inherit;
  font-size: 11px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 4px 4px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${r} .wou-clear-filters {
  flex-shrink: 0;
  font-size: 11px;
  white-space: nowrap;
  padding: 0 2px;
}
.${r} .wou-teach-wait { display: flex; align-items: flex-start; gap: 8px; }
.${r} .wou-teach-wait svg { width: 14px; height: 14px; flex-shrink: 0; margin-top: 3px; }
.${r} .wou-teach-prompt {
  position: relative;
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--wou-border);
  border-radius: 8px;
  background: var(--wou-card);
}
.${r} .wou-teach-prompt h2 { font-size: 13px; font-weight: 600; margin: 0 30px 6px 0; }
.${r} .wou-teach-prompt p { margin: 0 24px 10px 0; font-size: 12px; }
.${r} .wou-teach-prompt-actions { display: flex; align-items: center; gap: 14px; }
.${r} .wou-teach-prompt-close { position: absolute; top: 6px; right: 6px; border: none; background: none; color: var(--wou-muted); }
@media (prefers-reduced-motion: reduce) { .${r} .wou-teach-wait .wou-icon-spin { animation: none; } }
.${r} .wou-search-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.${r} .wou-search-row-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.${r} .wou-search-input {
  flex: 1 1 auto;
  min-width: 0;
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 5px 8px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${r} .wou-search-include {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
  color: var(--wou-muted);
}
.${r} .wou-search-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
}
.${r} .wou-search-filtered {
  font-size: 11px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.${r} .wou-search-empty {
  padding: 16px 0;
}
.${r} .wou-search-mark {
  background: var(--wou-search-highlight, var(--ui-selection-background, #fef08a));
  color: inherit;
  padding: 0;
}
.${r} .wou-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  flex-shrink: 0;
  white-space: nowrap;
}
.${r} .wou-muted { color: var(--wou-muted); font-size: 12px; }
.${r} .wou-section { margin-bottom: 16px; }
.${r} .wou-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid var(--wou-border);
  position: relative;
}
.${r} .wou-row-follow-selected {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--wou-accent) 18%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 5%, var(--wou-card));
  padding-left: 8px;
  padding-right: 8px;
  margin: 2px 0;
}
.${r} .wou-group-follow-selected > .wou-group-parent {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--wou-accent) 18%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 5%, var(--wou-card));
  padding-left: 8px;
  padding-right: 8px;
  margin: 2px 0;
}
.${r} .wou-row-nested {
  padding: 6px 0;
  border-bottom: none;
}
.${r} .wou-row-nested input[type="checkbox"] {
  width: 14px;
  height: 14px;
  margin-top: 2px;
  flex-shrink: 0;
}
.${r} .wou-row-nested .wou-topic {
  font-weight: 400;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.${r} .wou-row-nested .wou-ask {
  font-size: 13px;
  margin-top: 1px;
}
.${r} .wou-row-nested .wou-ask-only {
  margin-top: 0;
  color: var(--wou-fg);
}
.${r} .wou-icon-nested {
  min-width: 24px;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  opacity: 0;
  line-height: 1;
}
.${r} .wou-row-nested:hover .wou-icon-nested,
.${r} .wou-row-nested:focus-within .wou-icon-nested,
.${r} .wou-row-nested.wou-row-menu-open .wou-icon-nested {
  opacity: 1;
}
@media (hover: none) {
  .${r} .wou-icon-nested {
    opacity: 1;
  }
}
.${r} .wou-group {
  /* Groups sit in the list like any other card: same divider, no box. */
  border-bottom: 1px solid var(--wou-border);
}
.${r} .wou-group .wou-row {
  border-bottom: none;
}
.${r} .wou-group-parent {
  /* Left 9px + 16px chevron + 8px gap = the 33px left column single rows use. */
  padding: 8px 11px 8px 9px;
}
.${r} .wou-group-children {
  margin: 0 10px 8px calc(8px + 22px + 8px + 14px + 28px);
  padding-left: 10px;
  border-left: 2px solid var(--wou-border);
}
.${r} .wou-group-collapsed-preview {
  /* Same as a single card's ask line: muted, wraps. */
  margin: 2px 0 0;
  color: var(--wou-muted);
}
.${r} .wou-group-chevron-btn {
  border: none;
  background: none;
  padding: 2px 4px 0 0;
  color: var(--wou-muted);
  flex-shrink: 0;
}
.${r} .wou-group-checkbox-spacer {
  width: 13px;
  flex-shrink: 0;
}
.${r} .wou-group-title-line {
  display: block;
  min-width: 0;
}
.${r} .wou-group-title {
  display: inline;
  font-weight: 600;
}
.${r} .wou-card-title-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.${r} .wou-card-title-main {
  flex: 1;
  min-width: 0;
}
.${r} .wou-updated-at {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 11px;
}
.${r} .wou-chat-presence {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}
.${r} .wou-chat-presence-working {
  color: var(--dt-accent, var(--wou-accent));
}
.${r} .wou-chat-presence-na {
  font-style: italic;
}
.${r} .wou-open-session-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.${r} .wou-external-link-icon {
  flex-shrink: 0;
}
.${r} .wou-group-count-pill {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 6px;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 400;
  color: var(--wou-muted);
  background: color-mix(in srgb, var(--wou-card) 70%, var(--dt-muted, var(--wou-border)) 30%);
  border: 1px solid var(--wou-border);
  border-radius: 999px;
  padding: 1px 8px;
  line-height: 1.35;
  flex-shrink: 0;
}
@supports (background: color-mix(in srgb, white 50%, black)) {
  .${r} .wou-group-count-pill {
    background: color-mix(in srgb, var(--wou-card) 70%, var(--dt-muted, var(--wou-border)) 30%);
  }
}
.${r} .wou-group-confirm {
  margin-top: 8px;
  padding: 10px 12px 14px;
  font-size: 12px;
  border: 1.5px solid color-mix(in srgb, var(--wou-accent) 70%, var(--wou-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--wou-accent) 9%, var(--wou-card));
}
.${r} .wou-group-confirm-q {
  margin: 0 0 8px;
  font-weight: 600;
  font-size: 13px;
}
.${r} .wou-group-confirm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.${r} .wou-group-confirm-yes {
  background: var(--wou-accent);
  border-color: var(--wou-accent);
  color: var(--dt-primary-solid-foreground, #fcfcfc);
  font-weight: 600;
}
.${r} .wou-group-confirm-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  padding: 6px 6px 6px 10px;
  font-size: 11px;
  color: var(--wou-muted);
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
}
.${r} .wou-group-confirm-hint span { flex: 1; min-width: 0; padding-top: 1px; }
.${r} button.wou-tip-dismiss {
  flex: none;
  border: none;
  background: none;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
  color: var(--wou-muted);
}
.${r} button.wou-tip-dismiss:hover { color: var(--wou-fg); }
.${r} .wou-row-body { flex: 1; min-width: 0; }
.${r} .wou-topic { font-weight: 600; display: block; }
.${r} .wou-ask { color: var(--wou-muted); margin-top: 2px; }
.${r} .wou-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
}
.${r} .wou-badge {
  background: var(--wou-card);
  border: 1px solid var(--wou-border);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
}
.${r} {
  --wou-menu-hover: rgba(55, 53, 47, 0.08);
  --wou-menu-shadow-ring: rgba(15, 15, 15, 0.05);
  --wou-menu-shadow-mid: rgba(15, 15, 15, 0.1);
  --wou-menu-shadow-far: rgba(15, 15, 15, 0.2);
  --wou-menu-danger: #e03e3e;
  --wou-menu-danger-hover: rgba(224, 62, 62, 0.08);
}
:root.dark .${r} {
  --wou-menu-hover: rgba(255, 255, 255, 0.055);
  --wou-menu-shadow-ring: rgba(15, 15, 15, 0.2);
  --wou-menu-shadow-mid: rgba(15, 15, 15, 0.35);
  --wou-menu-shadow-far: rgba(15, 15, 15, 0.5);
  --wou-menu-danger: #ff7369;
  --wou-menu-danger-hover: rgba(255, 115, 105, 0.08);
}
.${r} .wou-menu {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 10;
  min-width: 232px;
  max-width: min(280px, calc(100vw - 24px));
  max-height: min(70vh, 520px);
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--wou-card);
  border: 1px solid var(--wou-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 6px 20px color-mix(in srgb, var(--wou-fg) 16%, transparent);
}
.${r} .wou-menu-notion {
  width: 240px;
  min-width: 240px;
  max-width: 240px;
  padding: 6px;
  box-shadow:
    0 0 0 1px var(--wou-menu-shadow-ring),
    0 3px 6px var(--wou-menu-shadow-mid),
    0 9px 24px var(--wou-menu-shadow-far);
}
.${r} .wou-menu-floating {
  position: fixed;
  right: auto;
  bottom: auto;
  z-index: 1000;
  max-height: none;
}
.${r} .wou-menu button.wou-menu-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 28px;
  padding: 0 8px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wou-fg);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.${r} .wou-menu button.wou-menu-row:hover,
.${r} .wou-menu button.wou-menu-row:focus-visible {
  background: var(--wou-menu-hover);
  outline: none;
}
.${r} .wou-menu-row-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--wou-muted);
}
.${r} .wou-menu-row-icon svg {
  display: block;
  width: 16px;
  height: 16px;
}
.${r} .wou-menu-row-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${r} .wou-menu-row-trail {
  flex-shrink: 0;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  color: var(--wou-fg);
}
.${r} .wou-menu-row-trail svg {
  width: 16px;
  height: 16px;
  display: block;
}
.${r} .wou-menu-row-danger,
.${r} .wou-menu-row-danger .wou-menu-row-icon {
  color: var(--wou-menu-danger);
}
.${r} .wou-menu-row-danger:hover,
.${r} .wou-menu-row-danger:focus-visible {
  background: var(--wou-menu-danger-hover);
}
.${r} .wou-menu-priority-sq,
.${r} .wou-menu-priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
  display: block;
}
.${r} .wou-quadrant-dot-1 { background: var(--dt-destructive, #e03e3e); }
.${r} .wou-quadrant-dot-2 { background: var(--wou-accent); }
.${r} .wou-quadrant-dot-3 {
  background: color-mix(in srgb, #f59e0b 85%, var(--wou-fg));
}
.${r} .wou-quadrant-dot-4 { background: var(--wou-muted); }
.${r} .wou-menu-section {
  font-size: 11px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
  color: var(--wou-muted);
  padding: 6px 8px 4px;
  user-select: none;
}
.${r} .wou-menu-empty-line {
  margin: 0;
  padding: 0 8px 4px;
  font-size: 12px;
  color: var(--wou-muted);
}
.${r} .wou-menu-tag-list-scroll {
  max-height: calc(6 * 28px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}
/* Always-visible scroll bar (macOS hides overlay bars until hover). */
.${r} .wou-menu-tag-list-scroll::-webkit-scrollbar { width: 8px; }
.${r} .wou-menu-tag-list-scroll::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--wou-border) 45%, transparent);
  border-radius: 4px;
}
.${r} .wou-menu-tag-list-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--wou-muted) 55%, transparent);
  border-radius: 4px;
  min-height: 24px;
}
.${r} .wou-menu-tag-list-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--wou-muted);
}
.${r} .wou-menu-sep {
  height: 1px;
  background: var(--wou-border);
  margin: 4px 0;
}
.${r} .wou-shortcuts-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.${r} .wou-shortcuts-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 12px;
  border-top: 1px solid var(--wou-border);
}
.${r} .wou-shortcuts-row:first-child {
  border-top: none;
  padding-top: 0;
}
.${r} .wou-shortcuts-label {
  flex: 1 1 auto;
  min-width: 0;
}
.${r} .wou-shortcuts-keys {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.${r} .wou-keycap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4em;
  padding: 2px 6px;
  border: 1px solid var(--wou-border);
  border-radius: 4px;
  background: color-mix(in srgb, var(--wou-card) 92%, var(--wou-muted) 8%);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.2;
  color: var(--wou-fg);
}
.${r} .wou-shortcuts-hint {
  font-size: 11px;
  color: var(--wou-muted);
  white-space: nowrap;
}
.${r} .wou-shortcuts-footer {
  margin: 10px 0 0;
  font-size: 11px;
}
.${r} .wou-inline-rename {
  width: 100%;
  margin-bottom: 4px;
}
.${r} .wou-inline-rename-input {
  display: block;
  width: 100%;
  font: inherit;
  font-weight: 600;
  font-size: inherit;
  line-height: inherit;
  padding: 2px 4px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wou-fg);
  outline: none;
  box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--wou-accent) 55%, transparent);
}
.${r} .wou-inline-rename-input::placeholder {
  color: var(--wou-fg);
  opacity: 0.45;
}
.${r} .wou-inline-rename-input:focus {
  box-shadow: inset 0 -2px 0 var(--wou-accent);
}
.${r} .wou-group-title.wou-inline-rename-input {
  font-size: 15px;
}
.${r} .wou-inline-rename-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.${r} .wou-inline-rename-save {
  border-color: var(--wou-accent);
  background: color-mix(in srgb, var(--wou-accent) 12%, var(--wou-card));
  color: var(--wou-accent);
}
.${r} .wou-inline-rename-ai {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.${r} .wou-inline-rename-ai svg {
  flex-shrink: 0;
  color: var(--wou-accent);
}
.${r} .wou-inline-rename-ai[aria-busy='true'] svg {
  animation: wou-ai-pulse 1s ease-in-out infinite;
}
@keyframes wou-ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.${r} .wou-inline-rename-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--wou-muted);
}
.${r} .wou-menu-kbd {
  font: inherit;
  font-size: 11px;
  color: var(--wou-muted);
  opacity: 0.8;
}
.${r} .wou-inline-rename-hint {
  font-size: 11px;
  color: var(--wou-muted);
}
.${r} .wou-undo {
  position: sticky;
  bottom: 0;
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--wou-card);
  border: 1px solid var(--wou-border);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.${r} .wou-page,
.${r} .wou-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}
.${r} .wou-page { padding: 16px; max-width: 720px; margin: 0 auto; width: 100%; }
.${r} .wou-pane { padding: 12px; }
.${r} .wou-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  margin-top: 8px;
}
.${r} .wou-project-filter-wrap {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
}
.${r} .wou-project-filter-btn {
  display: block;
  width: 100%;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}
.${r} .wou-project-filter-btn-label {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.${r} .wou-project-filter-menu {
  position: fixed;
  z-index: 1000;
  right: auto;
  max-height: min(320px, 60vh);
  overflow-x: hidden;
  overflow-y: auto;
  box-shadow: 0 6px 24px color-mix(in srgb, var(--wou-fg) 18%, transparent);
}
.${r} .wou-project-filter-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}
.${r} .wou-project-filter-row span {
  white-space: normal;
  overflow-wrap: anywhere;
  min-width: 0;
  flex: 1 1 auto;
}
.${r} .wou-project-filter-row:hover {
  background: var(--wou-border);
}
.${r} .wou-project-chip {
  font-style: normal;
  background: color-mix(in srgb, var(--wou-accent) 12%, var(--wou-card));
  border-color: color-mix(in srgb, var(--wou-accent) 30%, var(--wou-border));
}
.${r} .wou-submenu-wrap { position: relative; }
.${r} .wou-submenu {
  margin-left: 8px;
  border-left: 2px solid var(--wou-border);
  padding-left: 4px;
}
.${r} .wou-agent-chip {
  color: var(--wou-muted);
  font-size: 11px;
  border: 1px solid var(--wou-border);
  border-radius: 4px;
  padding: 0 5px;
  white-space: nowrap;
}
.${r} .wou-chat-link {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.${r} .wou-section-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font-size: 12px;
  font-weight: 600;
  margin: 0;
  padding: 8px 0 6px;
  color: var(--wou-muted);
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--dt-background, var(--wou-card));
}
.${r} .wou-section-heading:hover { color: var(--wou-fg); }
.${r} .wou-chevron {
  display: inline-block;
  transition: transform 0.15s ease;
  font-size: 10px;
}
.${r} .wou-chevron-collapsed { transform: rotate(-90deg); }
.${r} .wou-show-all {
  margin: 4px 0 8px;
}
.${r} .wou-settings-wrap { position: relative; }
.${r} .wou-settings-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 260px;
  max-width: 320px;
  padding: 10px 12px;
  background: var(--wou-card);
  border: 1px solid var(--wou-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.${r} .wou-settings-popover label {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  cursor: pointer;
}
.${r} .wou-footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--wou-border); }
.${r} .wou-closed-row { opacity: 0.85; }
.${r} .wou-row-pending {
  opacity: 0.55;
}
.${r} .wou-row-pending .wou-topic,
.${r} .wou-row-pending .wou-ask {
  text-decoration: line-through;
}
.${r} .wou-pending-label {
  font-size: 12px;
  color: var(--wou-muted);
  margin-top: 4px;
  font-style: italic;
}
@keyframes wou-spin {
  to { transform: rotate(360deg); }
}
.${r} .wou-snooze-form {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.${r} .wou-snooze-form-label {
  display: block;
  margin-bottom: 4px;
}
.${r} .wou-snooze-form input[type="datetime-local"] {
  font: inherit;
  color: var(--wou-fg);
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--wou-card);
}
.${r} .wou-snooze-error {
  margin: 0;
  font-size: 12px;
  color: var(--wou-muted);
}
.${r} .wou-snooze-actions {
  display: flex;
  gap: 8px;
}
.${r} .wou-header-status {
  font-size: 11px;
  white-space: nowrap;
}
.${r} .wou-scan-banner {
  font-size: 12px;
  padding: 6px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.${r} .wou-scan-banner-warn {
  color: var(--dt-destructive, #c2410c);
}
:root.dark .${r} .wou-scan-banner-warn {
  color: var(--dt-destructive, #fb923c);
}
.${r} .wou-first-run {
  padding: 24px 8px;
  max-width: 420px;
}
.${r} .wou-first-run-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px;
}
.${r} .wou-first-run p {
  margin: 0 0 10px;
  line-height: 1.5;
}
.${r} .wou-first-run-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  align-items: flex-start;
}
.${r} .wou-list-empty {
  padding: 32px 8px;
  text-align: center;
}
.${r} .wou-list-empty p {
  margin: 0 0 8px;
}
.${r} .wou-settings-view {
  padding-bottom: 16px;
  min-width: 0;
}
.${r} .wou-settings-view-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.${r} .wou-settings-back {
  flex-shrink: 0;
}
.${r} .wou-settings-view-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.${r} .wou-settings-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.${r} .wou-settings-card {
  border: 1px solid var(--wou-border);
  border-radius: 10px;
  padding: 12px 14px;
  min-width: 0;
}
.${r} .wou-settings-card h3 {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--wou-fg);
}
.${r} .wou-settings-section {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--wou-border);
}
.${r} .wou-settings-section h3 {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--wou-muted);
  margin: 0 0 10px;
}
.${r} .wou-settings-toggle-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--wou-border);
  min-width: 0;
}
.${r} .wou-settings-card > .wou-settings-toggle-row:first-of-type {
  border-top: none;
  padding-top: 0;
}
.${r} .wou-settings-toggle-label {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.${r} .wou-settings-row-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}
.${r} .wou-settings-row-desc {
  display: block;
  font-size: 11px;
  line-height: 1.35;
  margin-top: 4px;
}
.${r} .wou-switch {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  padding: 2px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.${r} .wou-switch-on {
  background: var(--ui-accent, var(--wou-accent));
  border-color: var(--ui-accent, var(--wou-accent));
}
.${r} .wou-switch-knob {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wou-fg);
  transition: transform 0.15s ease;
}
.${r} .wou-switch-on .wou-switch-knob {
  transform: translateX(18px);
  background: var(--wou-card);
}
.${r} .wou-mode-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.${r} .wou-mode-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.${r} .wou-mode-card-selected {
  border-color: var(--ui-accent, var(--wou-accent));
  box-shadow: inset 0 0 0 1px var(--ui-accent, var(--wou-accent));
}
.${r} .wou-mode-card-title {
  font-size: 12px;
  font-weight: 600;
}
.${r} .wou-mode-card-desc {
  font-size: 11px;
  line-height: 1.35;
}
.${r} .wou-settings-usage-line {
  margin: 0 0 8px;
  font-size: 12px;
}
.${r} .wou-usage-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--wou-border);
  overflow: hidden;
  margin-bottom: 10px;
}
.${r} .wou-usage-bar-fill {
  height: 100%;
  background: var(--ui-accent, var(--wou-accent));
  border-radius: 3px;
}
.${r} .wou-usage-bars {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  gap: 6px;
  align-items: flex-end;
  justify-content: space-between;
}
.${r} .wou-usage-bars li {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.${r} .wou-usage-bar-mini {
  width: 100%;
  max-width: 28px;
  height: 36px;
  border-radius: 3px;
  background: var(--wou-border);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.${r} .wou-usage-bar-mini-fill {
  width: 100%;
  background: var(--ui-accent, var(--wou-accent));
  border-radius: 3px 3px 0 0;
  min-height: 2px;
}
.${r} .wou-usage-bar-day {
  font-size: 9px;
}
.${r} .wou-settings-model-line {
  margin: 0;
  font-size: 11px;
}
.${r} .wou-settings-advanced-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--wou-fg);
  cursor: pointer;
  text-align: left;
}
.${r} .wou-settings-advanced-chevron {
  width: 12px;
  flex-shrink: 0;
}
.${r} .wou-settings-advanced-body {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--wou-border);
}
.${r} .wou-btn-compact {
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  color: var(--wou-fg);
  cursor: pointer;
  flex-shrink: 0;
}
.${r} .wou-link-compact {
  font-size: 11px;
}
.${r} .wou-settings-empty {
  margin: 0;
  font-size: 12px;
}

.${r} .wou-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 12px;
}
.${r} .wou-field-label {
  font-weight: 500;
}
.${r} .wou-field input[type="number"],
.${r} .wou-field select {
  font: inherit;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--wou-card);
  color: var(--wou-fg);
  max-width: 160px;
}
.${r} .wou-field-readonly {
  margin: 0;
  font-weight: 500;
}
.${r} .wou-field-error {
  color: var(--wou-muted);
  font-size: 11px;
}
.${r} .wou-settings-check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  cursor: pointer;
  margin-bottom: 10px;
}
.${r} .wou-usage-history {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  font-size: 11px;
}
.${r} .wou-usage-history li {
  padding: 2px 0;
}
.${r} .wou-source-excerpt {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-left: 3px solid var(--wou-border);
  color: var(--wou-muted);
  font-size: 12px;
  white-space: pre-wrap;
  font-style: italic;
  max-height: calc(1.45em * 15);
  overflow-y: auto;
}
.${r} .wou-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.${r} .wou-action-btn {
  font-size: 11px;
  padding: 2px 8px;
  line-height: 1.35;
}
.${r} .wou-action-btn-primary {
  background: var(--wou-accent);
  color: var(--dt-primary-foreground, #fff);
  border-color: var(--wou-accent);
}
.${r} .wou-action-btn-danger {
  border-color: var(--dt-destructive, #dc2626);
  color: var(--dt-destructive, #dc2626);
  background: transparent;
}
.${r} .wou-action-confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
}
.${r} .wou-action-confirm-text {
  flex: 1 1 100%;
  color: var(--wou-muted);
}

/* Alignment pass: each checkbox is centered on the first line of its title. */
.${r} .wou-row > input[type="checkbox"] {
  width: 16px; height: 16px; margin: 2px 0 0 0; flex-shrink: 0;
}
.${r} .wou-topic { line-height: 20px; }
.${r} .wou-group-parent > input[type="checkbox"],
.${r} .wou-group-parent > .wou-group-checkbox-spacer { margin-top: 2px; width: 16px; height: 16px; }
.${r} .wou-group-title-line { align-items: center; min-height: 20px; }
.${r} .wou-group-title { line-height: 20px; }
.${r} .wou-group-chevron-btn {
  width: 16px; height: 20px; padding: 0; display: inline-flex;
  align-items: center; justify-content: center;
}
.${r} .wou-row-nested > input[type="checkbox"] { width: 14px; height: 14px; margin: 2px 0 0 0; }
.${r} .wou-row-nested .wou-topic { line-height: 18px; }
.${r} .wou-row-nested .wou-ask-only { line-height: 18px; }
/* Same left column for single rows and group rows: card border + padding + chevron + gap. */
.${r} .wou-section > .wou-row:not(.wou-row-nested) { padding-left: 33px; padding-right: 11px; }
/* Children: guide line under the parent checkbox, child checkbox under the parent title. */
.${r} .wou-group-children { margin: 0 10px 8px 40px; padding-left: 15px; }

.${r}.wou-dialog {
  font: 13px/1.45 system-ui, sans-serif;
  color: var(--wou-fg);
  box-sizing: border-box;
}
.${r} .wou-composer-trigger {
  position: relative;
}
.${r} .wou-composer-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wou-accent);
  pointer-events: none;
}
.${r} .wou-composer-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
}
.${r} .wou-composer-body .wou-field {
  margin-bottom: 0;
  gap: 6px;
}
.${r} .wou-composer-body .wou-field-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--wou-muted);
}
.${r} .wou-field-hint {
  font-size: 11px;
  line-height: 1.35;
}
.${r} .wou-composer-body .wou-field select.wou-select {
  max-width: 100%;
  width: 100%;
}
.${r} .wou-composer-task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.${r} .wou-composer-task-item {
  padding: 8px 10px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  font-size: 12px;
}
.${r} .wou-composer-task-primary {
  font-weight: 500;
  margin: 0 0 4px;
}
.${r} .wou-composer-task-meta {
  margin: 0;
  font-size: 11px;
  color: var(--wou-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.${r} .wou-composer-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--wou-border);
  color: var(--wou-muted);
}
.${r} .wou-quadrant-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.${r} .wou-quadrant-option {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 11px;
  line-height: 1.3;
  cursor: pointer;
  padding: 8px 6px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  position: relative;
}
.${r} .wou-quadrant-option:has(input:checked) {
  border-color: var(--wou-accent);
  background: color-mix(in srgb, var(--wou-accent) 12%, var(--wou-card));
  color: var(--wou-accent);
}
.${r} .wou-quadrant-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  margin: 0;
}
.${r} .wou-composer-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--wou-muted);
}
.${r} .wou-composer-error-footer {
  justify-content: flex-end;
}
.${r} .wou-composer-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.${r} .wou-field input[type="text"],
.${r} .wou-field textarea {
  font: inherit;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--wou-card);
  color: var(--wou-fg);
  max-width: 100%;
  width: 100%;
}
.${r} .wou-field textarea {
  resize: vertical;
  min-height: 56px;
}
/* Tag colors: one hue per allowed color, mixed with the theme so text stays readable. */
.${r} {
  --wou-tag-gray: #8a8f98;
  --wou-tag-red: #e5484d;
  --wou-tag-orange: #f76b15;
  --wou-tag-yellow: #e2a336;
  --wou-tag-green: #30a46c;
  --wou-tag-teal: #12a594;
  --wou-tag-blue: #0090ff;
  --wou-tag-purple: #8e4ec6;
  --wou-tag-pink: #d6409f;
  --wou-tag-hue: var(--wou-tag-gray);
}
:root.dark .${r} {
  --wou-tag-gray: #9ba1a6;
  --wou-tag-red: #ff6369;
  --wou-tag-orange: #ff8b3e;
  --wou-tag-yellow: #f5c451;
  --wou-tag-green: #3dd68c;
  --wou-tag-teal: #0bd8b6;
  --wou-tag-blue: #52a9ff;
  --wou-tag-purple: #bf7af0;
  --wou-tag-pink: #f76fb8;
}
.${r} .wou-tc-gray { --wou-tag-hue: var(--wou-tag-gray); }
.${r} .wou-tc-red { --wou-tag-hue: var(--wou-tag-red); }
.${r} .wou-tc-orange { --wou-tag-hue: var(--wou-tag-orange); }
.${r} .wou-tc-yellow { --wou-tag-hue: var(--wou-tag-yellow); }
.${r} .wou-tc-green { --wou-tag-hue: var(--wou-tag-green); }
.${r} .wou-tc-teal { --wou-tag-hue: var(--wou-tag-teal); }
.${r} .wou-tc-blue { --wou-tag-hue: var(--wou-tag-blue); }
.${r} .wou-tc-purple { --wou-tag-hue: var(--wou-tag-purple); }
.${r} .wou-tc-pink { --wou-tag-hue: var(--wou-tag-pink); }
.${r} .wou-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 140px;
  padding: 0 7px;
  height: 18px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: color-mix(in srgb, var(--wou-tag-hue) 62%, var(--wou-fg));
  background: color-mix(in srgb, var(--wou-tag-hue) 14%, var(--wou-card));
  border: 1px solid color-mix(in srgb, var(--wou-tag-hue) 32%, var(--wou-border));
}
.${r} .wou-tag-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.${r} .wou-tag-chip svg {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}
.${r} .wou-tag-chip-more {
  color: var(--wou-muted);
  background: var(--wou-card);
  border-color: var(--wou-border);
}
.${r} .wou-tag-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--wou-tag-hue);
}
.${r} button.wou-project-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--wou-fg);
  cursor: pointer;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  font-size: 11px;
}
.${r} button.wou-project-chip:hover {
  border-color: color-mix(in srgb, var(--wou-accent) 55%, var(--wou-border));
}
.${r} .wou-project-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--wou-tag-hue);
}
.${r} .wou-task-context {
  margin-top: 2px;
  font-size: 12px;
  color: var(--wou-muted);
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.${r} .wou-due-chip {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  color: var(--wou-muted);
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
}
.${r} .wou-due-overdue,
.${r} .wou-due-today {
  color: color-mix(in srgb, var(--wou-tag-red) 75%, var(--wou-fg));
  background: color-mix(in srgb, var(--wou-tag-red) 12%, var(--wou-card));
  border-color: color-mix(in srgb, var(--wou-tag-red) 35%, var(--wou-border));
}
.${r} .wou-due-overdue { font-weight: 600; }
.${r} .wou-nested-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
}
.${r} .wou-menu-tag-check {
  display: inline-block;
  width: 16px;
  text-align: center;
  color: var(--wou-fg);
  font-weight: 600;
}
.${r} .wou-filter-menu-heading {
  padding: 6px 8px 2px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--wou-muted);
}
.${r} .wou-filter-menu-hint {
  margin: 0;
  padding: 4px 8px 6px;
  font-size: 11px;
  color: var(--wou-muted);
}
.${r} .wou-filter-menu-count {
  color: var(--wou-muted);
}
.${r} .wou-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.${r} button.wou-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 999px;
  border: 2px solid transparent;
  background: var(--wou-tag-hue);
  cursor: pointer;
  box-shadow: inset 0 0 0 2px var(--wou-card);
}
.${r} button.wou-swatch[aria-checked="true"] {
  border-color: var(--wou-fg);
}
.${r} .wou-settings-select-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--wou-border);
  min-width: 0;
}
.${r} .wou-settings-card > .wou-settings-select-row:first-of-type {
  border-top: none;
  padding-top: 0;
}
.${r} .wou-settings-select-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.${r} .wou-segmented {
  display: inline-flex;
  flex-shrink: 0;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  overflow: hidden;
}
.${r} .wou-segmented button {
  border: none;
  border-radius: 0;
  padding: 4px 9px;
  font-size: 12px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${r} .wou-segmented button + button {
  border-left: 1px solid var(--wou-border);
}
.${r} .wou-segmented button[aria-checked="true"] {
  background: color-mix(in srgb, var(--wou-accent) 18%, var(--wou-card));
  font-weight: 600;
}
.${r} .wou-tag-list {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
}
.${r} .wou-tag-list-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
  border-top: 1px solid var(--wou-border);
  font-size: 12px;
  min-width: 0;
}
.${r} .wou-tag-list-item:first-child { border-top: none; }
.${r} .wou-tag-list-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.${r} button.wou-tag-swatch-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--wou-tag-hue) 50%, var(--wou-border));
  background: var(--wou-tag-hue);
  flex-shrink: 0;
  cursor: pointer;
}
.${r} .wou-tag-list input[type="text"] {
  font: inherit;
  font-size: 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 3px 6px;
  background: transparent;
  color: var(--wou-fg);
  min-width: 0;
}
.${r} .wou-tag-list input[type="text"]:hover,
.${r} .wou-tag-list input[type="text"]:focus {
  border-color: var(--wou-border);
  background: var(--wou-card);
  outline: none;
}
.${r} .wou-tag-name-input { flex: 1 1 auto; font-weight: 600; }
.${r} .wou-tag-open-count { font-size: 11px; flex-shrink: 0; }
.${r} .wou-tag-hint-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 24px;
}
.${r} .wou-tag-hint-row input[type="text"] { width: 100%; }
.${r} .wou-tag-hint-label { font-size: 11px; }
.${r} .wou-tag-list .wou-swatches { padding-left: 24px; }
/* Teach priorities */
.${r} .wou-teach { outline: none; }
.${r} .wou-teach-progress { margin-left: auto; font-size: 12px; }
.${r} .wou-teach-card {
  border: 1px solid var(--wou-border);
  border-radius: 10px;
  padding: 14px;
}
.${r} .wou-teach-intro { margin: 0 0 10px; font-size: 12px; }
.${r} .wou-teach-ask {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}
.${r} .wou-teach-context {
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}
.${r} .wou-teach-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin: 0 0 4px;
}
.${r} .wou-teach-filed { font-size: 12px; margin: 0 0 12px; }
.${r} .wou-teach-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.${r} .wou-teach-choice {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  row-gap: 2px;
  align-items: center;
  text-align: left;
  min-height: 64px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  color: var(--wou-fg);
  font: inherit;
  cursor: pointer;
}
.${r} .wou-teach-choice:hover:not(:disabled),
.${r} .wou-teach-choice:focus-visible {
  border-color: var(--wou-accent);
}
.${r} .wou-teach-choice:disabled { opacity: 0.6; cursor: default; }
.${r} .wou-teach-choice .wou-keycap { grid-row: 1 / span 2; }
.${r} .wou-teach-choice-label { font-size: 13px; font-weight: 600; line-height: 1.3; }
.${r} .wou-teach-choice-hint { font-size: 11px; }
.${r} .wou-teach-choice-current {
  border-style: dashed;
}
.${r} .wou-teach-error { font-size: 12px; margin: 10px 0 0; }
.${r} .wou-teach-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.${r} .wou-teach-keys { font-size: 11px; margin-left: auto; }
.${r} .wou-teach-end { padding: 16px 4px; }
.${r} .wou-teach-end p { margin: 0 0 10px; line-height: 1.5; }
.${r} .wou-teach-end-actions { display: flex; gap: 8px; flex-wrap: wrap; }
/* What matters to you */
.${r} .wou-char-count { font-size: 11px; color: var(--wou-muted); align-self: flex-end; }
.${r} .wou-char-count-over { color: var(--dt-destructive, #c2410c); }
.${r} .wou-settings-inline-action {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
/* Decision model */
.${r} .wou-decision-intro { margin-bottom: 10px; line-height: 1.45; }
.${r} .wou-decision { margin-bottom: 4px; }
.${r} .wou-decision .wou-field select { max-width: 100%; }
.${r} .wou-decision-native { font-size: 12px; margin: 0 0 10px; }
.${r} .wou-decision-key { font-size: 12px; margin: 0 0 10px; }
.${r} .wou-decision-key-ok,
.${r} .wou-decision-key-missing { font-weight: 500; }
.${r} .wou-decision-test {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 12px;
}
.${r} .wou-decision-test-fail { color: var(--dt-destructive, #c2410c); }
.${r} .wou-decision-usage { font-size: 11px; margin: 0 0 6px; }
/* Tag suggestions */
.${r} .wou-suggest {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--wou-border);
}
.${r} .wou-suggest-head { display: flex; gap: 8px; flex-wrap: wrap; }
.${r} .wou-suggest-note { font-size: 11px; margin: 6px 0; }
.${r} .wou-suggest-error { font-size: 12px; margin: 6px 0; }
.${r} .wou-suggest-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.${r} .wou-suggest-main { display: flex; align-items: center; gap: 8px; min-width: 0; }
.${r} .wou-suggest-main .wou-tag-swatch-btn {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--wou-tag-hue) 50%, var(--wou-border));
  background: var(--wou-tag-hue);
  flex-shrink: 0;
}
.${r} .wou-suggest-main input[type="text"] {
  font: inherit;
  font-size: 12px;
  min-width: 0;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 3px 6px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${r} .wou-suggest-hint { font-size: 11px; margin: 2px 0 0 24px; }
.${r} .wou-suggest-added { font-size: 11px; }
/* First run, optional steps */
.${r} .wou-first-run-step { font-size: 11px; margin: 0 0 6px; }
.${r} .wou-first-run-actions-row { flex-direction: row; align-items: center; flex-wrap: wrap; }

/* ---- Clarity pass (all layouts) ---- */
/* The ask opens its one-line context when clicked; it reads as plain text. */
.${r} button.wou-ask-toggle {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: 0;
  border-radius: 4px;
  color: var(--wou-muted);
  font: inherit;
}
.${r} button.wou-ask-toggle:hover { color: var(--wou-fg); }
.${r} button.wou-ask-toggle:focus-visible { outline: 2px solid var(--wou-accent); outline-offset: 2px; }
.${r} .wou-row-nested button.wou-ask-toggle { font-size: 13px; margin-top: 1px; }
.${r} .wou-row-nested button.wou-ask-toggle.wou-ask-only { color: var(--wou-fg); margin-top: 0; line-height: 18px; }
.${r} .wou-task-context-open {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  margin-top: 4px;
  padding-left: 8px;
  border-left: 2px solid var(--wou-border);
}
/* Open session swaps in for the "updated" time on hover or keyboard focus. */
.${r} .wou-session-slot { display: none; flex-shrink: 0; font-size: 12px; }
.${r} .wou-row:hover > .wou-row-body > .wou-card-title-line .wou-session-slot,
.${r} .wou-row:focus-within > .wou-row-body > .wou-card-title-line .wou-session-slot { display: inline-flex; }
.${r} .wou-row:hover > .wou-row-body > .wou-card-title-line:has(.wou-session-slot) .wou-updated-at,
.${r} .wou-row:focus-within > .wou-row-body > .wou-card-title-line:has(.wou-session-slot) .wou-updated-at { display: none; }
/* The "\u2026" menu stays quiet until you point at the card. */
.${r} .wou-card-title-line button.wou-icon {
  border-color: transparent;
  background: transparent;
  opacity: 0;
  padding: 0 4px;
  min-width: 22px;
  line-height: 20px;
}
.${r} .wou-row:hover > .wou-row-body > .wou-card-title-line button.wou-icon,
.${r} .wou-row:focus-within > .wou-row-body > .wou-card-title-line button.wou-icon,
.${r} .wou-card-title-line button.wou-icon[aria-expanded="true"] { opacity: 1; }
.${r} .wou-card-title-line button.wou-icon:hover { background: var(--wou-menu-hover); }
@media (hover: none) {
  .${r} .wou-session-slot { display: inline-flex; }
  .${r} .wou-card-title-line button.wou-icon { opacity: 1; }
}

/* ---- Cards (default): each chat sits in its own box ---- */
.${r}.wou-layout-cards .wou-section > .wou-row:not(.wou-row-nested),
.${r}.wou-layout-cards .wou-flat-list > .wou-row:not(.wou-row-nested),
.${r}.wou-layout-cards .wou-section > .wou-group {
  border: 1px solid var(--wou-border);
  border-radius: 10px;
  margin: 0 0 8px;
  background: color-mix(in srgb, var(--wou-card) 60%, transparent);
}
.${r}.wou-layout-cards .wou-section > .wou-row:not(.wou-row-nested) { padding: 10px 8px 10px 12px; }
.${r}.wou-layout-cards .wou-group-parent { padding: 10px 8px 6px 8px; }
.${r}.wou-layout-cards .wou-group-children { margin: 0 12px 6px 46px; padding-left: 0; border-left: none; }
.${r}.wou-layout-cards .wou-section > .wou-row.wou-row-follow-selected:not(.wou-row-nested),
.${r}.wou-layout-cards .wou-flat-list > .wou-row.wou-row-follow-selected:not(.wou-row-nested),
.${r}.wou-layout-cards .wou-section > .wou-group.wou-group-follow-selected {
  border-color: color-mix(in srgb, var(--wou-accent) 18%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 5%, var(--wou-card));
}
/* The whole card carries the highlight, so the header inside it does not draw a second box. */
.${r}.wou-layout-cards .wou-section > .wou-group.wou-group-follow-selected > .wou-group-parent {
  border: none;
  background: none;
  margin: 0;
  padding: 10px 8px 6px 8px;
}

/* ---- Compact and Next up: one line per ask, no boxes ---- */
.${r}.wou-layout-compact .wou-row,
.${r}.wou-layout-focus .wou-row,
.${r}.wou-layout-compact .wou-group,
.${r}.wou-layout-focus .wou-group { border-bottom: none; }
.${r}.wou-layout-compact .wou-section > .wou-row:not(.wou-row-nested),
.${r}.wou-layout-focus .wou-section > .wou-row:not(.wou-row-nested) { padding-top: 5px; padding-bottom: 5px; border-radius: 6px; }
.${r}.wou-layout-compact .wou-section > .wou-row:not(.wou-row-nested):hover,
.${r}.wou-layout-focus .wou-section > .wou-row:not(.wou-row-nested):hover { background: var(--wou-menu-hover); }
/* Single tasks lead with the ask; the title becomes a small label above it. */
.${r}.wou-layout-compact .wou-section > .wou-row:not(.wou-row-nested) .wou-topic,
.${r}.wou-layout-focus .wou-section > .wou-row:not(.wou-row-nested) .wou-topic,
.${r}.wou-layout-compact .wou-flat-list > .wou-row .wou-topic,
.${r}.wou-layout-focus .wou-flat-list > .wou-row .wou-topic { font-weight: 400; font-size: 11.5px; color: var(--wou-muted); line-height: 16px; }
.${r}.wou-layout-compact .wou-section > .wou-row:not(.wou-row-nested) .wou-ask,
.${r}.wou-layout-focus .wou-section > .wou-row:not(.wou-row-nested) .wou-ask,
.${r}.wou-layout-compact .wou-flat-list > .wou-row .wou-ask,
.${r}.wou-layout-focus .wou-flat-list > .wou-row .wou-ask { color: var(--wou-fg); margin-top: 0; }
/* Group header becomes a quiet label row. */
.${r}.wou-layout-compact .wou-group-parent,
.${r}.wou-layout-focus .wou-group-parent { padding-top: 8px; padding-bottom: 2px; }
.${r}.wou-layout-compact .wou-group-title,
.${r}.wou-layout-focus .wou-group-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--wou-muted);
}
.${r}.wou-layout-compact .wou-group-count-pill,
.${r}.wou-layout-focus .wou-group-count-pill { display: none; }
.${r}.wou-layout-compact .wou-group-children,
.${r}.wou-layout-focus .wou-group-children { margin-bottom: 4px; border-left: none; padding-left: 0; margin-left: 33px; }
.${r}.wou-layout-compact .wou-row-nested,
.${r}.wou-layout-focus .wou-row-nested { padding: 4px 0; }

/* ---- Quiet metadata: agent, project, tags and due read as text, not buttons ---- */
.${r} :is(.wou-meta, .wou-nested-meta) {
  margin-top: 6px;
  column-gap: 0;
  row-gap: 2px;
  font-size: 12px;
  color: var(--wou-muted);
}
.${r} :is(.wou-meta, .wou-nested-meta) > :is(.wou-agent-chip, .wou-badge, .wou-project-chip, .wou-tag-chip, .wou-due-chip),
.${r} :is(.wou-meta, .wou-nested-meta) > button.wou-project-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: auto;
  padding: 0;
  border: none;
  border-radius: 0;
  background: none;
  box-shadow: none;
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
  color: var(--wou-muted);
}
.${r} :is(.wou-meta, .wou-nested-meta) > .wou-tag-chip:not(.wou-tag-chip-more) {
  color: color-mix(in srgb, var(--wou-tag-hue) 70%, var(--wou-fg));
}
.${r} :is(.wou-meta, .wou-nested-meta) > :is(.wou-due-today, .wou-due-overdue) {
  color: color-mix(in srgb, var(--wou-tag-red) 80%, var(--wou-fg));
  font-weight: 500;
}
.${r} :is(.wou-meta, .wou-nested-meta) > .wou-due-overdue { font-weight: 600; }
.${r} :is(.wou-meta, .wou-nested-meta) > button.wou-project-chip:hover {
  color: var(--wou-fg);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.${r} :is(.wou-meta, .wou-nested-meta) > button.wou-project-chip:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--wou-accent) 60%, transparent);
  outline-offset: 1px;
  border-radius: 3px;
}
/* A middle dot between neighbouring items: "Ada \xB7 Demo \xB7 Due today". */
.${r} :is(.wou-meta, .wou-nested-meta) > :is(.wou-agent-chip, .wou-badge, .wou-project-chip, .wou-tag-chip, .wou-due-chip) ~ :is(.wou-agent-chip, .wou-badge, .wou-project-chip, .wou-tag-chip, .wou-due-chip)::before {
  content: '\xB7';
  content: '\xB7' / '';
  margin: 0 6px;
  color: var(--wou-muted);
  font-weight: 400;
  text-decoration: none;
  display: inline-block;
}
/* Metadata sits under the ask, above the answer buttons. */
.${r} .wou-row-body > :is(.wou-meta, .wou-nested-meta) + .wou-answer { margin-top: 8px; }

/* ---- Answer bar: Yes \xB7 No \xB7 Reply \xB7 Later \xB7 Open session ---- */
/* The selected task: a quiet neutral tint, no edge bar. Sub-items carry their own inline padding
   (offset by an equal negative margin so text stays aligned) and a little space between them, so
   the tint frames the checkbox and never sits on a neighbouring ask's text. */
.${r} {
  --wou-active-tint: color-mix(in srgb, var(--wou-fg) 4%, transparent);
}
.${r} .wou-row.wou-row-active {
  background: var(--wou-active-tint);
  border-radius: 6px;
}
.${r} .wou-group-children > .wou-row-nested {
  padding-left: 6px;
  padding-right: 6px;
  margin-left: -6px;
  margin-right: -6px;
  border-radius: 6px;
}
.${r} .wou-group-children > .wou-row-nested + .wou-row-nested { margin-top: 4px; }
.${r}.wou-layout-cards .wou-group-children > .wou-row-nested { padding-top: 8px; padding-bottom: 8px; }
.${r}.wou-layout-cards .wou-group-children > .wou-row-nested:first-child { margin-top: 4px; }
.${r}.wou-layout-cards .wou-section > .wou-row.wou-row-active:not(.wou-row-nested),
.${r}.wou-layout-cards .wou-flat-list > .wou-row.wou-row-active:not(.wou-row-nested) {
  background: color-mix(in srgb, var(--wou-fg) 4%, var(--wou-card));
  border-radius: 10px;
}
.${r} .wou-row[data-wou-task-id]:focus { outline: none; }
.${r} .wou-answer { margin-top: 8px; }
.${r} .wou-answer-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
/* Answer buttons keep one text/background pair in every state, so their contrast is exactly
   the theme's own: secondary buttons are fg on card, Yes is Hermes's contrast-adjusted
   solid-primary pair (or, on hosts without it, the inverse fg/card pair). Hover and press
   show through the border and shadow, never by blending the fill toward the text colour. */
.${r} .wou-answer-bar .wou-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  box-sizing: border-box;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 12px;
  border-radius: 6px;
  color: var(--wou-fg);
  background: var(--wou-card);
  border: 1px solid color-mix(in srgb, var(--wou-fg) 30%, var(--wou-border));
  box-shadow: 0 1px 2px color-mix(in srgb, var(--wou-fg) 16%, transparent);
  transition: border-color 80ms ease, box-shadow 80ms ease;
}
.${r} .wou-answer-bar .wou-action-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--wou-fg) 60%, var(--wou-border));
  box-shadow: 0 1px 3px color-mix(in srgb, var(--wou-fg) 24%, transparent);
}
.${r} .wou-answer-bar .wou-action-btn:active:not(:disabled) {
  border-color: color-mix(in srgb, var(--wou-fg) 60%, var(--wou-border));
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--wou-fg) 28%, transparent);
  transform: translateY(1px);
}
.${r} .wou-answer-bar .wou-action-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--wou-accent) 60%, transparent);
  outline-offset: 1px;
}
.${r} .wou-answer-bar .wou-action-btn.wou-answer-yes,
.${r} .wou-answer-bar .wou-action-btn.wou-answer-yes:hover:not(:disabled),
.${r} .wou-answer-bar .wou-action-btn.wou-answer-yes:active:not(:disabled) {
  color: var(--dt-primary-solid-foreground, var(--wou-card));
  background: var(--dt-primary-solid, var(--wou-fg));
  border-color: var(--dt-primary-solid, var(--wou-fg));
}
.${r} .wou-answer-open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.${r} .wou-answer-reply {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.${r} .wou-answer-reply-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  resize: vertical;
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  padding: 6px 8px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${r} .wou-answer-reply-input:focus {
  outline: 2px solid color-mix(in srgb, var(--wou-accent) 55%, transparent);
  outline-offset: 0;
  border-color: var(--wou-accent);
}
.${r} .wou-answer-reply-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.${r} .wou-answer-reply-hint { font-size: 11px; }
.${r} .wou-answer-pending {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--wou-muted);
}
.${r} .wou-answer-unsupported {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--wou-muted);
}

/* ---- Next up box ---- */
.${r} .wou-next-up {
  border: 1px solid color-mix(in srgb, var(--wou-accent) 40%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 7%, var(--wou-card));
  border-radius: 10px;
  padding: 12px 14px;
  margin: 10px 0 14px;
}
.${r} .wou-next-up-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--wou-accent);
}
.${r} .wou-next-up > .wou-row { padding: 6px 0 0; border-bottom: none; }
.${r} .wou-next-up > .wou-row-follow-selected { padding: 6px 8px; margin: 4px 0 0; }
.${r} .wou-next-up > .wou-row .wou-ask,
.${r} .wou-next-up > .wou-row button.wou-ask-toggle { color: var(--wou-fg); font-size: 14.5px; font-weight: 600; line-height: 1.35; }
.${r} .wou-next-up-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.${r} .wou-next-up-primary {
  background: var(--wou-accent);
  border-color: var(--wou-accent);
  color: var(--dt-primary-solid-foreground, #fcfcfc);
  font-weight: 600;
}

/* ---- Filters behind one button ---- */
.${r} .wou-filter-btn { position: relative; }
.${r} .wou-filter-btn[aria-expanded="true"] { border-color: var(--wou-accent); color: var(--wou-accent); }
.${r} .wou-filter-btn-on::after {
  content: '';
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wou-accent);
}
.${r} .wou-header-row2 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.${r} .wou-header-row2 .wou-select,
.${r} .wou-header-row2 .wou-project-filter-wrap { width: 100%; min-width: 0; }
.${r} .wou-header-row2 .wou-clear-filters { grid-column: 1 / -1; justify-self: start; }
.${r} .wou-filter-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 11px;
  min-width: 0;
}
.${r} .wou-filter-summary-text {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--wou-muted);
  font-size: 11px;
}
.${r} .wou-filter-summary .wou-clear-filters { flex-shrink: 0; }

/* ---- Narrow panes: use the full width ---- */
.${r} { container-type: inline-size; }
@container (max-width: 380px) {
  .${r} .wou-header-row2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .${r} .wou-pane { padding: 10px 8px; }
  .${r} .wou-header-actions { gap: 2px; }
  .${r} .wou-header-actions .wou-icon-btn { width: 26px; height: 26px; border-color: transparent; background: transparent; }
  .${r} .wou-header-actions .wou-filter-btn[aria-expanded="true"] { border-color: var(--wou-accent); }
  .${r} .wou-title { font-size: 14px; }
  .${r} .wou-header-updated { display: none; }
  .${r} .wou-section-heading { padding-left: 0; padding-right: 0; }
  /* Single cards and group headers */
  .${r}.wou-layout-cards .wou-section > .wou-row:not(.wou-row-nested) { padding: 8px 6px 8px 10px; }
  .${r}.wou-layout-cards .wou-group-parent,
  .${r}.wou-layout-cards .wou-section > .wou-group.wou-group-follow-selected > .wou-group-parent { padding: 8px 6px 4px 4px; }
  .${r} .wou-section > .wou-row:not(.wou-row-nested) { padding-left: 22px; padding-right: 4px; }
  .${r} .wou-group-parent { padding-right: 4px; }
  /* Asks under a group start under the group's checkbox, not its title. */
  .${r} .wou-group-children,
  .${r}.wou-layout-cards .wou-group-children,
  .${r}.wou-layout-compact .wou-group-children,
  .${r}.wou-layout-focus .wou-group-children { margin: 0 6px 6px 24px; padding-left: 0; border-left: none; }
  /* The "updated" time steals a column on every card; hide it, Open session still shows on hover/focus. */
  .${r} .wou-card-title-line .wou-updated-at { display: none; }
  .${r} .wou-next-up { padding: 10px; }
  /* A nested ask's "\u2026" keeps its own column (never covers text), just a narrower one. */
  .${r} .wou-icon-nested { min-width: 18px; width: 18px; }
  .${r} .wou-row-nested { gap: 6px; }
}
`;import{host as Bp}from"@hermes/plugin-sdk";var vu=Bp.notify;function ae(e){vu({kind:"info",message:e})}function ue(e,t){vu(t?{kind:"error",message:e,detail:t}:{kind:"error",message:e})}var it="waiting-on-you-desktop",_o=`plugin.${it}.tasks.changed`,Su=`plugin.${it}.settings.changed`,vs=[{registerSlotId:"open-keybind",keybindId:`${it}.open-keybind`,keybindLabel:o.keybindOpen,settingsLabel:o.settingsShortcutOpen,defaults:["mod+alt+y"],category:"view"},{registerSlotId:"undo-keybind",keybindId:`${it}.undo`,keybindLabel:o.keybindUndoLabel,settingsLabel:o.settingsShortcutUndo,paletteLabel:o.paletteUndo,defaults:["mod+z"],category:"view"},{registerSlotId:"toggle-priorities-keybind",keybindId:`${it}.toggle-priorities`,keybindLabel:o.keybindTogglePriorities,settingsLabel:o.settingsShortcutTogglePriorities,paletteLabel:o.paletteTogglePriorities,defaults:["mod+alt+p"],category:"view"},{registerSlotId:"toggle-project-badges-keybind",keybindId:`${it}.toggle-project-badges`,keybindLabel:o.keybindToggleProjectBadges,settingsLabel:o.settingsShortcutToggleProjectBadges,paletteLabel:o.paletteToggleProjectBadges,defaults:["mod+alt+b"],category:"view"},{registerSlotId:"toggle-groups-keybind",keybindId:`${it}.toggle-groups`,keybindLabel:o.keybindToggleAllGroups,settingsLabel:o.settingsShortcutToggleAllGroups,paletteLabel:o.paletteToggleAllGroups,defaults:["mod+alt+e"],category:"view"},{registerSlotId:"toggle-answer-bars-keybind",keybindId:`${it}.toggle-answer-bars`,keybindLabel:o.keybindToggleAnswerBars,settingsLabel:o.settingsShortcutToggleAnswerBars,paletteLabel:o.paletteToggleAnswerBars,defaults:["mod+alt+a"],category:"view"},{registerSlotId:"scan-keybind",keybindId:`${it}.scan`,keybindLabel:o.keybindScan,settingsLabel:o.settingsShortcutScan,paletteLabel:o.paletteScan,defaults:["mod+alt+r"],category:"view"}],Cu=[...vs.map(e=>({id:e.keybindId,label:e.settingsLabel,display:{kind:"combo",combo:e.defaults[0]}})),{id:`${it}.answer-keys`,label:o.settingsShortcutAnswerKeys,display:{kind:"hint",text:o.settingsShortcutAnswerKeysHint}},{id:`${it}.option-click-groups`,label:o.settingsShortcutCollapseGroups,display:{kind:"hint",text:o.settingsShortcutCollapseGroupsHint}}],Tu={mod:"\u2318",alt:"\u2325",shift:"\u21E7",ctrl:"\u2303"};function Nu(e){return e.split("+").map(t=>t.trim()).filter(Boolean).map(t=>{let n=t.toLowerCase();return n in Tu?Tu[n]:(t.length===1,t.toUpperCase())})}import{Fragment as Ss,jsx as ce,jsxs as Xe}from"react/jsx-runtime";var Au=_o,Qp=[1,2,3,4],qp={1:o.quadrantBar1,2:o.quadrantBar2,3:o.quadrantBar3,4:o.quadrantBar4};function Vp(e,t){let n=e.ask?.trim();return n||Co(e,t)||o.composerUntitled}function _u({value:e,disabled:t,onChange:n}){return ce("div",{className:"wou-quadrant-grid",role:"radiogroup","aria-label":o.composerQuadrantLabel,children:Qp.map(a=>Xe("label",{className:"wou-quadrant-option",children:[ce("input",{type:"radio",name:"wou-quadrant",value:a,checked:e===a,disabled:t,onChange:()=>n(a)}),ce("span",{children:qp[a]})]},a))})}function Ru({ctx:e}){let t=sn.state.focusedStoredSessionId,n=sn.state.focusedSessionProfile,a=sn.state.focusedSessionOwner,s=sn.state.connectionId,l=t?Jr(t):null,c=n?Jr(n):"default",p=a?Jr(a):null,d=s?Jr(s):null,m=Wp(Zt,Ke,Ke),[w,f]=bt(!1),[h,_]=bt(null),[v,x]=bt(null),[b,S]=bt("add"),[A,F]=bt(""),[te,pe]=bt(2),[re,R]=bt(!1),[Y,Z]=bt(!1),[G,j]=bt(!1),[z,le]=bt(!0),[Ee,He]=bt(""),[Ne,he]=bt(!1),X=$u(async N=>{if(l)try{let B=await Xr(e,l,c,p,d);if(B.kind==="not_found"){x(B.error),_(null);return}x(null),_(B.data)}catch{x(null),_(null),N?.notifyError&&ue(o.loadError)}},[e,l,c,p,d]);Hn(()=>{l&&X()},[l,c,p,X]),Hn(()=>{if(!l)return;let N=()=>{X()},B=[];return e.onEvent?B.push(e.onEvent(Au,N)):sn.onEvent&&B.push(sn.onEvent(Au,N)),()=>{for(let ge of B)ge()}},[e,l,X]),Hn(()=>{!w||!l||(X({notifyError:!0}),(async()=>{try{let N=await Po(e);j(N.settings.name_after_chat),le(Qr(N.settings)!=="none")}catch{ue(o.loadError)}})())},[w,l,e,X]),Hn(()=>{w&&(h?.tracked?(S("tracked"),pe(is(h.tasks,h.group))):(S("add"),pe(2),F("")))},[w,h?.tracked,h?.chat_key]);let be=$u(()=>{if(!h||h.tasks.length===0)return"";let N=Mn(h.tasks,h.chat_key);return N.kind==="task"?Co(h.tasks.find(B=>B.id===N.taskId)??h.tasks[0],G):h.group?Jo(h.group,G):Co(h.tasks[0],G)},[h,G]);Hn(()=>{!w||b!=="tracked"||!h||He(be())},[w,b,h,be,G]);let q=async()=>{if(!h||b!=="tracked")return;let N=Ee.trim(),B=be().trim();if(N===B)return;let ge=Mn(h.tasks,h.chat_key);he(!0);try{ge.kind==="task"?await Ft(e,ge.taskId,{title:N||null}):await Ot(e,ge.chatKey,{title:N||null}),jn(),await X()}catch{ue(o.patchError),He(be())}finally{he(!1)}};if(!t||!l||!m)return null;let E=h?.tracked??!1,J=h?.tasks.length??0,Pe=E&&J>0,Ie=Pe?o.composerButtonTracked(J):o.composerButton,$e=async N=>{if(!h)return;let B=Mn(h.tasks,h.chat_key);Z(!0);try{B.kind==="task"?await Ft(e,B.taskId,N):await Ot(e,B.chatKey,N),jn(),await X()}catch(ge){co(ge)?(an()&&ae(o.notOnThisProfile),f(!1)):ue(o.patchError)}finally{Z(!1)}},De=async N=>{pe(N),b==="tracked"&&h&&await $e({quadrant:N})},_e=async()=>{if(l){R(!0);try{await bu(e,l,c,p,d,{ask:A.trim()||void 0,quadrant:te}),ae(o.composerAdded),f(!1),F(""),await X()}catch(N){let B=Ae(N);co(N)?(an()&&ae(o.notOnThisProfile),f(!1)):B.status===404?(x(B.error),S("add")):ue(o.patchError)}finally{R(!1)}}},ee=async()=>{if(!h)return;R(!0);let N=Mn(h.tasks,h.chat_key);try{let B=!1;N.kind==="task"?await Ft(e,N.taskId,{status:"done"}):B=!!(await Ot(e,N.chatKey,{status:"done",task_ids:yl(h.tasks)})).already_closed,jn(),ae(B?o.alreadyCleared:o.composerCompleted),f(!1),await X()}catch(B){co(B)?(an()&&ae(o.notOnThisProfile),f(!1)):rn(B)?(ae(o.alreadyCleared),f(!1),jn(),await X()):ue(o.patchError)}finally{R(!1)}},Te=v!=null?!1:!E||b==="add",se=v?o.composerButton:Te?o.composerAddTitle:o.composerTrackedTitle;return Xe(Ss,{children:[ce("style",{children:xu}),Xe("button",{type:"button",className:`${r} wou-icon-btn wou-composer-trigger`,"aria-label":Ie,title:Ie,onClick:()=>f(!0),children:[ce(Vr,{}),Pe?ce("span",{className:"wou-composer-badge","aria-hidden":"true"}):null]}),ce(Hp,{open:w,onOpenChange:f,children:Xe(Gp,{className:`${r} wou-dialog`,children:[ce("style",{children:Ao}),Xe(Up,{children:[ce(Kp,{children:se}),v?ce(Pu,{className:"wou-composer-error",children:v}):Te?ce(Pu,{children:o.composerAddDescription}):null]}),ce("div",{className:"wou-composer-body",children:v?null:Te?Xe(Ss,{children:[Xe("label",{className:"wou-field",children:[ce("span",{className:"wou-field-label",children:o.composerAskLabel}),ce("textarea",{rows:3,value:A,maxLength:300,placeholder:o.composerAskPlaceholder,onChange:N=>F(N.target.value),disabled:re})]}),z?Xe("div",{className:"wou-field",children:[ce("span",{className:"wou-field-label",children:o.composerQuadrantLabel}),ce(_u,{value:te,disabled:re,onChange:pe})]}):null]}):h?Xe(Ss,{children:[Xe("label",{className:"wou-field",children:[ce("span",{className:"wou-field-label",children:o.renameLabel}),ce("input",{type:"text",value:Ee,maxLength:120,disabled:Ne||Y||re,onChange:N=>He(N.target.value),onBlur:()=>{q()},onKeyDown:N=>{N.key==="Enter"&&(N.preventDefault(),q())}}),Ne?ce("span",{className:"wou-muted",role:"status",children:o.scanning}):null]}),ce("ul",{className:"wou-composer-task-list",children:h.tasks.map(N=>Xe("li",{className:"wou-composer-task-item",children:[ce("p",{className:"wou-composer-task-primary",children:Vp(N,G)}),Xe("p",{className:"wou-composer-task-meta",children:[N.project?ce("span",{children:N.project.name}):null,ce("span",{children:Fr(N.quadrant)}),N.status==="snoozed"?ce("span",{className:"wou-composer-tag",children:o.composerSnoozed}):null]})]},N.id))}),z?Xe("div",{className:"wou-field",children:[ce("span",{className:"wou-field-label",children:o.composerQuadrantLabel}),ce(_u,{value:te,disabled:Y||re,onChange:N=>{De(N)}})]}):null,ce("button",{type:"button",className:"wou-link",onClick:()=>{S("add"),pe(is(h.tasks,h.group)),F("")},children:o.composerAddAnother})]}):null}),v?ce(Ts,{className:"wou-composer-error-footer",children:ce(Bn,{type:"button",variant:"secondary",onClick:()=>f(!1),children:o.composerClose})}):Te?Xe(Ts,{className:"wou-composer-footer",children:[ce(Bn,{type:"button",variant:"secondary",disabled:re,onClick:()=>f(!1),children:o.composerCancel}),ce(Bn,{type:"button",disabled:re,onClick:()=>{_e()},children:o.composerAdd})]}):Xe(Ts,{className:"wou-composer-footer",children:[ce(Bn,{type:"button",variant:"secondary",disabled:re||Y,onClick:()=>f(!1),children:o.composerCancel}),ce(Bn,{type:"button",disabled:re||Y,onClick:()=>{ee()},children:o.composerMarkComplete})]})]})})]})}import{host as We,useValue as Vs}from"@hermes/plugin-sdk";import{useCallback as U,useEffect as Ce,useLayoutEffect as Od,useMemo as Oe,useRef as Re,useState as K,useSyncExternalStore as km}from"react";import{useState as ng}from"react";import{useCallback as Iu,useEffect as Yp,useRef as Xp,useState as ln}from"react";function Eu(e,t,n,a,s,l,c){if(l!==c)return e;let p={...e};for(let d of["model","base_url","cloudflare_account_id"])e[d]===t[d]&&(t[d]===n[d]||d in a)&&(p[d]=s[d]);return p}import{Fragment as Du,jsx as Ze,jsxs as jt}from"react/jsx-runtime";function ea({ctx:e,compact:t}){let[n,a]=ln(null),[s,l]=ln(null),[c,p]=ln(null),[d,m]=ln({model:"",base_url:"",cloudflare_account_id:""}),w=Xp(0),[f,h]=ln(!1),[_,v]=ln(null),x=Iu(R=>{a(R),m({model:R.model,base_url:R.base_url,cloudflare_account_id:R.cloudflare_account_id})},[]),b=Iu(async()=>{try{x(await ou(e)),l(null)}catch(R){l(Ae(R).error||o.decisionLoadError)}},[e,x]);Yp(()=>{b()},[b]);let S=async R=>{let Y=++w.current,Z={...d},G=n?{model:n.model,base_url:n.base_url,cloudflare_account_id:n.cloudflare_account_id}:Z;p(null),v(null);try{let j=await nu(e,R);if(Y!==w.current)return;a(j),m(z=>Eu(z,Z,G,R,j,Y,w.current))}catch(j){Y===w.current&&p(Ae(j).error||o.decisionSaveError)}};if(!n)return s?jt("p",{className:"wou-muted",role:"alert",children:[s," ",Ze("button",{type:"button",className:"wou-link",onClick:()=>{b()},children:o.retry})]}):Ze("p",{className:"wou-muted",role:"status",children:o.settingsLoading});let A=n.providers.find(R=>R.id===n.provider)??null,F=R=>{if(R===n.provider)return;let Y=n.providers.find(Z=>Z.id===R);S(Y?{provider:R,model:Y.default_model}:{provider:""})},te=R=>{let Y=d[R].trim();Y!==n[R]&&S({[R]:Y})},pe=(R,Y,Z)=>jt("label",{className:"wou-field",children:[Ze("span",{className:"wou-field-label",children:Y}),Ze("input",{type:"text",value:d[R],placeholder:Z,spellCheck:!1,autoComplete:"off",onChange:G=>m(j=>({...j,[R]:G.target.value})),onBlur:()=>te(R),onKeyDown:G=>{G.key==="Enter"&&(G.preventDefault(),G.currentTarget.blur())}})]}),re=async()=>{h(!0),v(null);try{let R=await ru(e);v({ok:R.ok,text:jl(R)})}catch(R){v({ok:!1,text:Ae(R).error||o.decisionTestFailedPlain})}finally{h(!1)}};return jt("div",{className:"wou-decision",children:[n.native_available?Ze("p",{className:"wou-decision-native",children:o.decisionNative}):null,jt("label",{className:"wou-field",children:[Ze("span",{className:"wou-field-label",children:o.decisionProvider}),jt("select",{value:n.provider,onChange:R=>F(R.target.value),children:[Ze("option",{value:"",children:o.decisionProviderOff}),n.providers.map(R=>Ze("option",{value:R.id,children:R.label},R.id))]}),A?.note?Ze("span",{className:"wou-muted",children:A.note}):null]}),A?jt(Du,{children:[pe("model",o.decisionModel,A.default_model),A.needs_base_url?pe("base_url",o.decisionBaseUrl,"https://"):null,A.needs_account_id?pe("cloudflare_account_id",o.decisionAccountId):null,A.needs_key?jt("p",{className:"wou-decision-key",children:[Ze("span",{className:n.key_set?"wou-decision-key-ok":"wou-decision-key-missing",children:n.key_set?o.decisionKeySaved:o.decisionKeyNotSet}),n.key_set?null:jt("span",{className:"wou-muted",children:[" ",o.decisionKeyWhere(o.decisionKeyPath,n.key_name)]})]}):null]}):null,c?Ze("p",{className:"wou-field-error",role:"alert",children:c}):null,A||n.native_available?jt("div",{className:"wou-decision-test",children:[Ze("button",{type:"button",className:"wou-btn-compact",onClick:()=>{re()},disabled:f,"aria-busy":f,children:f?o.decisionTesting:o.decisionTest}),_?Ze("span",{className:_.ok?"wou-decision-test-ok":"wou-decision-test-fail",role:"status",children:_.text}):null]}):null,t?null:jt(Du,{children:[Ze("p",{className:"wou-muted wou-decision-usage",children:o.decisionUsageToday(n.usage_today.calls,n.usage_today.input_tokens)}),n.last_error?Ze("p",{className:"wou-muted wou-decision-usage",children:o.decisionLastError(n.last_error)}):null]})]})}import{useState as Cs}from"react";import{Fragment as tg,jsx as Jt,jsxs as Gn}from"react/jsx-runtime";var Zp=3;function Pt(e){return`wou-tc-${In(e)}`}function Jp(e){return e?Or.includes(e)?{className:Pt(e)}:/^#[0-9a-f]{3,8}$/i.test(e)?{className:"",style:{"--wou-tag-hue":e}}:{className:""}:{className:""}}function eg({tag:e}){let t=e.source==="auto";return Gn("span",{className:`wou-tag-chip ${Pt(e.color)}`,title:t?`${e.name} \xB7 ${o.tagAddedByAi}`:e.name,children:[t?Jt("span",{"aria-label":o.tagAddedByAi,role:"img",style:{display:"inline-flex"},children:Jt(uo,{})}):null,Jt("span",{className:"wou-tag-chip-name",children:e.name})]})}function Un({tags:e}){if(e.length===0)return null;let{shown:t,extra:n}=el(e,Zp),a=e.slice(t.length).map(s=>s.name).join(", ");return Gn(tg,{children:[t.map(s=>Jt(eg,{tag:s},s.id)),n>0?Gn("span",{className:"wou-tag-chip wou-tag-chip-more",title:o.tagMoreTitle(a),children:["+",n]}):null]})}function ta({project:e,onClick:t}){let n=Jp(e.color),a=e.color&&(n.className||n.style)?Jt("span",{className:`wou-project-dot ${n.className}`,style:n.style,"aria-hidden":"true"}):null;return t?Gn("button",{type:"button",className:"wou-badge wou-project-chip",title:o.projectBadgeTip(e.name),onClick:()=>t(e),children:[a,Jt("span",{className:"wou-tag-chip-name",children:e.name})]}):Gn("span",{className:"wou-badge wou-project-chip",children:[a,e.name]})}function Ro({dueAt:e,now:t}){if(e==null)return null;let n=Al(e,t);if(!n)return null;let a=new Date(e*1e3).toLocaleString(void 0,{dateStyle:"full",timeStyle:"short"});return Jt("span",{className:`wou-due-chip wou-due-${n.tone}`,title:a,children:n.label})}function oa({value:e,onChange:t,disabled:n,label:a}){let s=In(e);return Jt("div",{className:"wou-swatches",role:"radiogroup","aria-label":a,children:Or.map(l=>Jt("button",{type:"button",role:"radio","aria-checked":s===l,"aria-label":o.tagColorName(l),title:o.tagColorName(l),className:`wou-swatch ${Pt(l)}`,disabled:n,onClick:()=>t(l)},l))})}import{Fragment as og,jsx as yt,jsxs as un}from"react/jsx-runtime";function na({ctx:e,tags:t,onAddTag:n}){let[a,s]=Cs(null),[l,c]=Cs(!1),[p,d]=Cs(null),m=t.map(x=>x.name),w=async()=>{c(!0),d(null);try{let x=await au(e);s(Bl(x,m))}catch(x){d(Ae(x).error||o.tagSuggestError)}finally{c(!1)}},f=async x=>{let b=ws(x.name);if(b){s(S=>S&&No(S,x.key,"pending",b));return}if(Ul(x,m)){s(S=>S&&No(S,x.key,"pending",o.tagSuggestTaken));return}s(S=>S&&No(S,x.key,"adding"));try{await n({name:x.name.trim(),color:x.color,hint:x.hint}),s(S=>S&&No(S,x.key,"added"))}catch(S){s(A=>A&&No(A,x.key,"pending",Ae(S).error||o.tagSaveError))}},h=async()=>{if(a)for(let x of Gl(a,m))await f(x)},_=a?.filter(x=>x.status!=="skipped")??[],v=a?Kl(a):0;return un("div",{className:"wou-suggest",children:[un("div",{className:"wou-suggest-head",children:[yt("button",{type:"button",className:"wou-btn-compact",onClick:()=>{w()},disabled:l,"aria-busy":l,children:l?o.tagSuggesting:o.tagSuggest}),a&&v>1?yt("button",{type:"button",className:"wou-btn-compact",onClick:()=>{h()},children:o.tagSuggestAddAll}):null]}),yt("p",{className:"wou-muted wou-suggest-note",children:o.tagSuggestNote}),p?yt("p",{className:"wou-suggest-error",role:"alert",children:p}):null,a&&_.length===0&&!l?yt("p",{className:"wou-muted wou-settings-empty",children:o.tagSuggestEmpty}):null,_.length>0?yt("ul",{className:"wou-suggest-list",children:_.map(x=>{let b=x.status==="added",S=x.status==="adding";return un("li",{className:"wou-suggest-item",children:[un("div",{className:"wou-suggest-main",children:[yt("span",{className:`wou-tag-swatch-btn ${Pt(x.color)}`,"aria-hidden":"true"}),yt("input",{type:"text",className:"wou-tag-name-input",value:x.name,maxLength:32,disabled:b||S,"aria-label":o.tagSuggestRename(x.name),onChange:A=>s(F=>F&&Hl(F,x.key,A.target.value)),onKeyDown:A=>{A.key==="Enter"&&(A.preventDefault(),f(x))}}),b?yt("span",{className:"wou-muted wou-suggest-added",children:o.tagSuggestAdded}):un(og,{children:[yt("button",{type:"button",className:"wou-btn-compact",disabled:S,onClick:()=>{f(x)},children:o.tagSuggestAdd}),yt("button",{type:"button",className:"wou-link wou-link-compact",disabled:S,onClick:()=>s(A=>A&&No(A,x.key,"skipped")),children:o.tagSuggestSkip})]})]}),x.hint||x.example_count>0?un("p",{className:"wou-muted wou-suggest-hint",children:[x.hint,x.hint&&x.example_count>0?" \xB7 ":"",x.example_count>0?o.tagSuggestExamples(x.example_count):""]}):null,x.error?yt("p",{className:"wou-field-error",role:"alert",children:x.error}):null]},x.key)})}):null]})}function Mu(e){return e.get("teach-card",!1)===!0}function ra(e,t,n=0){return t==="session"&&!(n>0)?!1:(e.set("teach-card",!0),!0)}function Lu(e){return e.desktop&&e.consented&&e.scanned&&e.availability==="ready"&&!e.resolved&&!e.onboarding&&!e.settings&&!e.teaching&&!e.searching&&!e.closed}function Ou(e,t){return e||t==="checking"?"waiting":t==="ready"?"ready":"empty"}import{Fragment as aa,jsx as Se,jsxs as $t}from"react/jsx-runtime";function Fu({settings:e,model:t,scanning:n,onStart:a,onChangeSettings:s}){let l=e.mode,c=pl(e.daily_call_cap),p=ll(l,e.sweep_minutes);return $t("div",{className:"wou-first-run",children:[Se("h2",{className:"wou-first-run-title",children:o.pluginName}),Se("p",{children:o.firstRunLine1}),Se("p",{children:o.firstRunLine2(t.label)}),Se("p",{children:o.firstRunLine3(p,c,e.lookback_days)}),n?Se("p",{className:"wou-muted",role:"status",children:o.scanningHint}):null,$t("div",{className:"wou-first-run-actions",children:[Se("button",{type:"button",onClick:a,disabled:n,"aria-busy":n,children:n?o.scanning:o.firstRunStart}),Se("button",{type:"button",className:"wou-link",onClick:s,disabled:n,children:o.firstRunChangeSettings})]})]})}var Ns=["decision","tags","teach"];function ju({ctx:e,tags:t,scanning:n,teachAvailability:a,onAddTag:s,onTeachNow:l,onFinish:c}){let p=Ou(n,a),[d,m]=ng("decision"),w=Ns.indexOf(d),f=()=>{let h=Ns[w+1];h?m(h):c()};return $t("div",{className:"wou-first-run wou-first-run-steps",children:[Se("p",{className:"wou-muted wou-first-run-step",children:o.firstRunStepOf(w+1,Ns.length)}),d==="decision"?$t(aa,{children:[Se("h2",{className:"wou-first-run-title",children:o.firstRunDecisionTitle}),Se("p",{children:o.decisionIntro}),Se(ea,{ctx:e,compact:!0}),$t("div",{className:"wou-first-run-actions wou-first-run-actions-row",children:[Se("button",{type:"button",onClick:f,children:o.firstRunNext}),Se("button",{type:"button",className:"wou-link",onClick:f,children:o.firstRunSkip})]})]}):null,d==="tags"?$t(aa,{children:[Se("h2",{className:"wou-first-run-title",children:o.firstRunTagsTitle}),Se("p",{children:o.firstRunTagsIntro}),Se(na,{ctx:e,tags:t,onAddTag:s}),$t("div",{className:"wou-first-run-actions wou-first-run-actions-row",children:[Se("button",{type:"button",onClick:f,children:o.firstRunNext}),Se("button",{type:"button",className:"wou-link",onClick:f,children:o.firstRunSkip})]})]}):null,d==="teach"?$t(aa,{children:[Se("h2",{className:"wou-first-run-title",children:o.firstRunTeachTitle}),Se("p",{children:o.firstRunTeachIntro}),p==="waiting"?$t("p",{className:"wou-muted wou-teach-wait",role:"status",children:[Se(qr,{className:"wou-icon-spin"}),n?o.firstRunTeachWait:o.teachLoading]}):null,p==="empty"?$t(aa,{children:[Se("p",{className:"wou-muted",children:o.firstRunTeachEmpty}),Se("button",{type:"button",onClick:c,children:o.firstRunFinish})]}):$t("div",{className:"wou-first-run-actions wou-first-run-actions-row",children:[Se("button",{type:"button",onClick:l,disabled:p!=="ready",children:o.firstRunTeachNow}),Se("button",{type:"button",className:"wou-link",onClick:c,children:o.firstRunLater})]})]}):null]})}import{useCallback as Ps,useEffect as Kn,useRef as Eo,useState as zt}from"react";import{Button as zu,Dialog as rg,DialogContent as ag,DialogDescription as sg,DialogFooter as ig,DialogHeader as lg,DialogTitle as ug}from"@hermes/plugin-sdk";import{useEffect as cg,useState as sa}from"react";import{jsx as At,jsxs as cn}from"react/jsx-runtime";function dg(e){let t=e.trim();if(!t)return t;let n=t.charAt(0).toUpperCase()+t.slice(1);return/[.!?]$/.test(n)?n:`${n}.`}function dn({open:e,onOpenChange:t,createTag:n,onCreated:a,applies:s}){let[l,c]=sa(""),[p,d]=sa("gray"),[m,w]=sa(!1),[f,h]=sa(null);cg(()=>{e&&(c(""),d("gray"),h(null),w(!1))},[e]);let _=async()=>{let v=l.trim();if(!m){if(v.length<1||v.length>32){h(o.tagNameInvalid);return}w(!0),h(null);try{let x=await n(v,p);if(!x){h(o.tagSaveError);return}a?.(x),t(!1)}catch(x){let b=Ae(x).error;h(b?dg(b):o.tagSaveError)}finally{w(!1)}}};return At(rg,{open:e,onOpenChange:t,children:cn(ag,{className:`${r} wou-dialog`,children:[At("style",{children:Ao}),cn(lg,{children:[At(ug,{children:o.tagNewTitle}),At(sg,{children:s?o.tagNewDescriptionApply:o.tagNewDescription})]}),cn("div",{className:"wou-composer-body",children:[cn("label",{className:"wou-field",children:[At("span",{className:"wou-field-label",children:o.tagName}),At("input",{type:"text",value:l,maxLength:32,autoFocus:!0,disabled:m,placeholder:o.tagNamePlaceholder,onChange:v=>{c(v.target.value),h(null)},onKeyDown:v=>{v.key==="Enter"&&(v.preventDefault(),_())}})]}),cn("div",{className:"wou-field",children:[At("span",{className:"wou-field-label",children:o.tagColor}),At(oa,{value:p,onChange:d,disabled:m,label:o.tagColor})]}),f?At("p",{className:"wou-snooze-error",role:"alert",children:f}):null]}),cn(ig,{className:"wou-composer-footer",children:[At(zu,{type:"button",variant:"secondary",disabled:m,onClick:()=>t(!1),children:o.snoozeCancel}),At(zu,{type:"button",disabled:m||!l.trim(),onClick:()=>{_()},children:o.tagCreate})]})]})})}function Bu(e){let t=Promise.resolve(),n={},a=new Map,s=0,l=c=>({...c,...n});return{merge:l,edit(c){n={...n,...c};for(let p of Object.keys(c))a.set(p,++s)},save(c){let p={...c},d=new Map(a),m=t.then(async()=>{let w=await e(p);for(let f of Object.keys(p))a.get(f)===d.get(f)&&delete n[f];return l(w)});return t=m.then(()=>{},()=>{}),m}}}import{jsx as ia,jsxs as Hu}from"react/jsx-runtime";function po({checked:e,onChange:t,label:n,description:a,id:s}){return Hu("div",{className:"wou-settings-toggle-row",children:[ia("button",{type:"button",id:s,role:"switch","aria-checked":e,"aria-labelledby":`${s}-label`,className:`wou-switch${e?" wou-switch-on":""}`,onClick:()=>t(!e),children:ia("span",{className:"wou-switch-knob","aria-hidden":"true"})}),Hu("button",{type:"button",className:"wou-settings-toggle-label",onClick:()=>t(!e),children:[ia("span",{id:`${s}-label`,className:"wou-settings-row-label",children:n}),a?ia("span",{className:"wou-muted wou-settings-row-desc",children:a}):null]})]})}import{jsx as C,jsxs as de}from"react/jsx-runtime";var pg=500,Gu="settingsAdvancedOpen",gg=[{value:"priority",label:o.groupByPriority},{value:"project",label:o.groupByProject},{value:"none",label:o.groupByNone}],mg=[{value:"cards",label:o.layoutCards},{value:"compact",label:o.layoutCompact},{value:"focus",label:o.layoutFocus}];function fg({tag:e,onPatch:t,onDelete:n}){let[a,s]=zt(e.name),[l,c]=zt(e.hint??""),[p,d]=zt(!1);Kn(()=>s(e.name),[e.name]),Kn(()=>c(e.hint??""),[e.hint]);let m=async()=>{let f=a.trim();if(f===e.name){s(e.name);return}if(f.length<1||f.length>32){ue(o.tagNameInvalid),s(e.name);return}await t(e.id,{name:f})||s(e.name)},w=async()=>{let f=l.trim();f!==(e.hint??"").trim()&&(await t(e.id,{hint:f})||c(e.hint??""))};return de("li",{className:"wou-tag-list-item",children:[de("div",{className:"wou-tag-list-main",children:[C("button",{type:"button",className:`wou-tag-swatch-btn ${Pt(e.color)}`,"aria-label":o.tagChangeColor(e.name),title:o.tagChangeColor(e.name),"aria-expanded":p,onClick:()=>d(f=>!f)}),C("input",{type:"text",className:"wou-tag-name-input",value:a,maxLength:32,"aria-label":o.tagRename(e.name),onChange:f=>s(f.target.value),onBlur:()=>{m()},onKeyDown:f=>{f.key==="Enter"&&(f.preventDefault(),f.currentTarget.blur()),f.key==="Escape"&&(s(e.name),f.currentTarget.blur())}}),C("span",{className:"wou-muted wou-tag-open-count",children:o.tagOpenCount(e.open_count??0)}),C("button",{type:"button",className:"wou-link wou-link-compact",onClick:()=>n(e),children:o.tagDelete})]}),p?C(oa,{value:e.color,label:o.tagColor,onChange:f=>{d(!1),f!==e.color&&t(e.id,{color:f})}}):null,de("label",{className:"wou-tag-hint-row",children:[C("span",{className:"wou-muted wou-tag-hint-label",children:o.tagHintLabel}),C("input",{type:"text",value:l,maxLength:200,placeholder:o.tagHintPlaceholder,onChange:f=>c(f.target.value),onBlur:()=>{w()},onKeyDown:f=>{f.key==="Enter"&&(f.preventDefault(),f.currentTarget.blur())}})]})]})}var wg=[{mode:"auto",title:o.settingsModeAutoTitle,description:e=>o.settingsModeAutoDesc(e)},{mode:"hourly",title:o.settingsModeHourlyTitle,description:()=>o.settingsModeHourlyDesc},{mode:"manual",title:o.settingsModeManualTitle,description:()=>o.settingsModeManualDesc},{mode:"off",title:o.settingsModeOffTitle,description:()=>o.settingsModeOffDesc}];function hg(e,t){return e.includes(t)?e:null}function Uu({ctx:e,bundle:t,tags:n,onCreateTag:a,onPatchTag:s,onDeleteTag:l,onAddSuggestedTag:c,onBundleChange:p,onOpenTeach:d,onBack:m}){let[w,f]=zt(!1),[h,_]=zt(t.settings),[v,x]=zt({}),[b,S]=zt(()=>e.storage.get(Gu,!1)),A=Eo(null),F=Eo({}),te=Eo(e),pe=Eo(t),re=Eo(p);te.current=e,pe.current=t,re.current=p;let[R]=zt(()=>Bu(async y=>(await $o(te.current,y)).settings));Kn(()=>{_(R.merge(t.settings))},[t.settings,R]);let Y=Ps(async()=>{let y={...F.current};if(F.current={},Object.keys(y).length!==0)try{let H=await R.save(y),me=R.merge(H),Le={...pe.current,settings:me};pe.current=Le,re.current(Le),_(me),x(ke=>{let et={...ke};for(let ct of Object.keys(y))delete et[ct];return et})}catch(H){let me=H?.message??o.patchError,Le={};for(let ke of Object.keys(y)){let et=hg(me,ke);et&&(Le[ke]=et)}Object.keys(Le).length===0?ue(me):x(ke=>({...ke,...Le}))}},[R]),Z=Eo(Y);Z.current=Y;let G=Ps(y=>{R.edit(y),F.current={...F.current,...y},A.current&&clearTimeout(A.current),A.current=setTimeout(()=>{A.current=null,Z.current()},pg)},[R]),j=Ps(y=>{R.edit(y),F.current={...F.current,...y},A.current&&(clearTimeout(A.current),A.current=null),Z.current()},[R]);Kn(()=>()=>{A.current&&clearTimeout(A.current),A.current=null,Z.current()},[]);let z=()=>{A.current&&clearTimeout(A.current),A.current=null,Z.current(),m()},le=tn(h.group_by,h.show_priorities),Ee=y=>{_(H=>({...H,group_by:y,show_priorities:y!=="none"})),j({group_by:y})},He=Ur(h.layout),Ne=y=>{_(H=>({...H,layout:y})),j({layout:y})},he=y=>{_(H=>({...H,mode:y})),x(H=>({...H,mode:void 0})),j({mode:y})},X=(y,H)=>{_(me=>({...me,[y]:H})),j({[y]:H})},[be,q]=zt({}),E=(y,H)=>{q(ke=>({...ke,[y]:H}));let me=il(y,H);if(x(ke=>({...ke,[y]:me??void 0})),me)return;let Le=sl(y,Number(H));_(ke=>({...ke,[y]:Le})),G({[y]:Le})},J=y=>{q(H=>{if(!(y in H))return H;let me={...H};return delete me[y],me}),x(H=>H[y]?{...H,[y]:void 0}:H)},Pe=y=>be[y]??String(h[y]),Ie=h.priorities_note??"",[$e,De]=zt(Ie),_e=Eo(!1);Kn(()=>{_e.current||De(Ie)},[Ie]);let ee=fs($e,ps),Te=y=>{De(y),!fs(y,ps).over&&G({priorities_note:y})},se=()=>{_e.current=!1,!ee.over&&($e!==Ie||"priorities_note"in F.current)&&(_(y=>({...y,priorities_note:$e})),j({priorities_note:$e}))},N=()=>{let y=!b;S(y),e.storage.set(Gu,y)},B=t.model,ge=t.usage.today,ye=t.usage.history,I=h.daily_call_cap,ie=dl(ge.calls,I),Me=Math.max(1,...ye.map(y=>y.calls));return de("div",{className:"wou-settings-view",children:[de("div",{className:"wou-settings-view-header",children:[C("button",{type:"button",className:"wou-link wou-settings-back",onClick:z,children:o.settingsBack}),C("h2",{className:"wou-settings-view-title",children:o.settings})]}),de("div",{className:"wou-settings-stack",children:[de("section",{className:"wou-settings-card","aria-labelledby":"wou-set-titles",children:[C("h3",{id:"wou-set-titles",children:o.settingsTaskTitlesSection}),de("div",{className:"wou-settings-select-row",children:[de("div",{className:"wou-settings-select-text",children:[C("span",{id:"wou-set-layout-label",className:"wou-settings-row-label",children:o.layoutLabel}),C("span",{className:"wou-muted wou-settings-row-desc",children:o.layoutHelp})]}),C("div",{className:"wou-segmented",role:"radiogroup","aria-labelledby":"wou-set-layout-label",children:mg.map(y=>C("button",{type:"button",role:"radio","aria-checked":He===y.value,onClick:()=>Ne(y.value),children:y.label},y.value))})]}),C(po,{id:"wou-set-name-after-chat",checked:h.name_after_chat,onChange:y=>X("name_after_chat",y),label:o.nameAfterChat,description:o.nameAfterChatHelp}),de("div",{className:"wou-settings-select-row",children:[de("div",{className:"wou-settings-select-text",children:[C("span",{id:"wou-set-group-by-label",className:"wou-settings-row-label",children:o.groupByLabel}),C("span",{className:"wou-muted wou-settings-row-desc",children:o.groupByHelp})]}),C("div",{className:"wou-segmented",role:"radiogroup","aria-labelledby":"wou-set-group-by-label",children:gg.map(y=>C("button",{type:"button",role:"radio","aria-checked":le===y.value,onClick:()=>Ee(y.value),children:y.label},y.value))})]}),C(po,{id:"wou-set-show-project-badges",checked:h.show_project_badges,onChange:y=>X("show_project_badges",y),label:o.showProjectBadges,description:o.showProjectBadgesHelp}),C(po,{id:"wou-set-follow-selected-chat",checked:h.follow_selected_chat,onChange:y=>X("follow_selected_chat",y),label:o.followSelectedChat,description:o.followSelectedChatHelp}),C(po,{id:"wou-set-archive-chat",checked:h.archive_chat_on_done,onChange:y=>X("archive_chat_on_done",y),label:o.archiveChatOnDone,description:o.archiveChatHelp})]}),de("section",{className:"wou-settings-card","aria-labelledby":"wou-set-priorities-note",children:[C("h3",{id:"wou-set-priorities-note",children:o.prioritiesNoteSection}),de("label",{className:"wou-field",children:[C("span",{className:"wou-muted",children:o.prioritiesNoteHelp}),C("textarea",{value:$e,rows:3,placeholder:o.prioritiesNotePlaceholder,"aria-label":o.prioritiesNoteLabel,"aria-invalid":ee.over,onFocus:()=>{_e.current=!0},onChange:y=>Te(y.target.value),onBlur:se}),C("span",{className:`wou-char-count${ee.over?" wou-char-count-over":""}`,"aria-live":ee.near?"polite":"off",children:ee.label}),ee.over?C("span",{className:"wou-field-error",role:"alert",children:o.prioritiesNoteTooLong}):null]}),de("div",{className:"wou-settings-inline-action",children:[C("button",{type:"button",className:"wou-btn-compact",onClick:d,children:o.teachFromSettings}),C("span",{className:"wou-muted wou-settings-row-desc",children:o.teachFromSettingsHelp})]})]}),de("section",{className:"wou-settings-card","aria-labelledby":"wou-set-decision",children:[C("h3",{id:"wou-set-decision",children:o.decisionSection}),C("p",{className:"wou-muted wou-settings-empty wou-decision-intro",children:o.decisionIntro}),C(ea,{ctx:e}),C(po,{id:"wou-set-decision-gate",checked:h.decision_gate??!0,onChange:y=>X("decision_gate",y),label:o.decisionGate,description:o.decisionGateHelp}),C(po,{id:"wou-set-decision-priority",checked:h.decision_priority??!0,onChange:y=>X("decision_priority",y),label:o.decisionPriority,description:o.decisionPriorityHelp}),C("p",{className:"wou-muted wou-settings-empty",children:o.decisionNeedsModel})]}),de("section",{className:"wou-settings-card","aria-labelledby":"wou-set-tags",children:[C("h3",{id:"wou-set-tags",children:o.tagsSection}),C("p",{className:"wou-muted wou-settings-empty",children:o.tagsIntro}),C(po,{id:"wou-set-auto-tag",checked:h.auto_tag,onChange:y=>X("auto_tag",y),label:o.autoTag,description:`${o.autoTagHelp} ${o.autoTagDecisionNote}`}),n.length===0?C("p",{className:"wou-muted wou-settings-empty",children:o.tagsEmpty}):C("ul",{className:"wou-tag-list",children:n.map(y=>C(fg,{tag:y,onPatch:s,onDelete:l},y.id))}),C("button",{type:"button",className:"wou-btn-compact",onClick:()=>f(!0),children:o.tagAdd}),C(dn,{open:w,onOpenChange:f,createTag:a}),C(na,{ctx:e,tags:n,onAddTag:c})]}),de("section",{className:"wou-settings-card","aria-labelledby":"wou-set-shortcuts",children:[C("h3",{id:"wou-set-shortcuts",children:o.settingsShortcutsSection}),C("ul",{className:"wou-shortcuts-list",children:Cu.map(y=>de("li",{className:"wou-shortcuts-row",children:[C("span",{className:"wou-shortcuts-label",children:y.label}),C("span",{className:"wou-shortcuts-keys",children:y.display.kind==="combo"?Nu(y.display.combo).map((H,me)=>C("kbd",{className:"wou-keycap",children:H},`${y.id}-${me}`)):C("span",{className:"wou-shortcuts-hint",children:y.display.text})})]},y.id))}),C("p",{className:"wou-muted wou-shortcuts-footer",children:o.settingsShortcutsFooter})]}),de("section",{className:"wou-settings-card","aria-labelledby":"wou-set-frequency",children:[C("h3",{id:"wou-set-frequency",children:o.settingsFrequencySection}),C("div",{className:"wou-mode-cards",role:"radiogroup","aria-label":o.settingsFrequencySection,children:wg.map(y=>{let H=h.mode===y.mode;return de("button",{type:"button",role:"radio","aria-checked":H,className:`wou-mode-card${H?" wou-mode-card-selected":""}`,onClick:()=>he(y.mode),children:[C("span",{className:"wou-mode-card-title",children:y.title}),C("span",{className:"wou-muted wou-mode-card-desc",children:y.description(h.sweep_minutes)})]},y.mode)})})]}),de("section",{className:"wou-settings-card","aria-labelledby":"wou-set-usage",children:[C("h3",{id:"wou-set-usage",children:o.settingsUsageSection}),C("p",{className:"wou-settings-usage-line",children:as(ge.calls,I)}),I>0&&ge.calls>I?C("p",{className:"wou-muted wou-settings-usage-over",children:o.settingsUsageOver(ge.manual_calls??0)}):null,I>0?C("div",{className:"wou-usage-bar",role:"progressbar","aria-valuenow":ge.calls,"aria-valuemin":0,"aria-valuemax":I,"aria-label":as(ge.calls,I),children:C("div",{className:"wou-usage-bar-fill",style:{width:`${Math.round(ie*100)}%`}})}):null,C("ul",{className:"wou-usage-bars","aria-label":o.settingsUsageHistory,children:ye.map(y=>de("li",{title:y.date,children:[C("span",{className:"wou-usage-bar-mini","aria-hidden":"true",children:C("span",{className:"wou-usage-bar-mini-fill",style:{height:`${Math.round(y.calls/Me*100)}%`}})}),C("span",{className:"wou-muted wou-usage-bar-day",children:y.date.slice(5)})]},y.date))}),C("p",{className:"wou-muted wou-settings-model-line",children:o.settingsUsageModel(B.label)})]}),de("section",{className:"wou-settings-card wou-settings-advanced",children:[de("button",{type:"button",className:"wou-settings-advanced-toggle","aria-expanded":b,onClick:N,children:[C("span",{className:"wou-settings-advanced-chevron","aria-hidden":"true",children:b?"\u25BE":"\u25B8"}),o.settingsAdvanced]}),b?de("div",{className:"wou-settings-advanced-body",children:[Gr("sweep_minutes",h.mode)?de("label",{className:"wou-field",children:[C("span",{className:"wou-field-label",children:o.settingsSweep}),C("input",{type:"number",min:15,max:240,value:Pe("sweep_minutes"),onBlur:()=>J("sweep_minutes"),onChange:y=>E("sweep_minutes",y.target.value),"aria-label":o.settingsSweep,"aria-invalid":!!v.sweep_minutes}),v.sweep_minutes?C("span",{className:"wou-field-error",role:"alert",children:v.sweep_minutes}):null]}):null,Gr("debounce_seconds",h.mode)?de("label",{className:"wou-field",children:[C("span",{className:"wou-field-label",children:o.settingsDebounce}),C("input",{type:"number",min:30,max:600,value:Pe("debounce_seconds"),onBlur:()=>J("debounce_seconds"),onChange:y=>E("debounce_seconds",y.target.value),"aria-label":o.settingsDebounce,"aria-invalid":!!v.debounce_seconds}),v.debounce_seconds?C("span",{className:"wou-field-error",role:"alert",children:v.debounce_seconds}):null]}):null,Gr("max_chats_per_scan",h.mode)?de("label",{className:"wou-field",children:[C("span",{className:"wou-field-label",children:o.settingsMaxChats}),C("input",{type:"number",min:5,max:100,value:Pe("max_chats_per_scan"),onBlur:()=>J("max_chats_per_scan"),onChange:y=>E("max_chats_per_scan",y.target.value),"aria-label":o.settingsMaxChats,"aria-invalid":!!v.max_chats_per_scan}),v.max_chats_per_scan?C("span",{className:"wou-field-error",role:"alert",children:v.max_chats_per_scan}):null]}):null,de("label",{className:"wou-field",children:[C("span",{className:"wou-field-label",children:o.settingsDailyCap}),C("input",{type:"number",min:0,max:2e3,value:Pe("daily_call_cap"),onBlur:()=>J("daily_call_cap"),onChange:y=>E("daily_call_cap",y.target.value),"aria-label":o.settingsDailyCap,"aria-invalid":!!v.daily_call_cap}),C("span",{className:"wou-muted",children:o.settingsDailyCapHint}),v.daily_call_cap?C("span",{className:"wou-field-error",role:"alert",children:v.daily_call_cap}):null]}),de("label",{className:"wou-field",children:[C("span",{className:"wou-field-label",children:o.settingsLookback}),C("input",{type:"number",min:1,max:30,value:Pe("lookback_days"),onBlur:()=>J("lookback_days"),onChange:y=>E("lookback_days",y.target.value),"aria-label":o.settingsLookback,"aria-invalid":!!v.lookback_days}),v.lookback_days?C("span",{className:"wou-field-error",role:"alert",children:v.lookback_days}):null]}),de("label",{className:"wou-field",children:[C("span",{className:"wou-field-label",children:o.settingsRetention}),C("input",{type:"number",min:0,max:365,value:Pe("retention_days"),onBlur:()=>J("retention_days"),onChange:y=>E("retention_days",y.target.value),"aria-label":o.settingsRetention,"aria-invalid":!!v.retention_days}),C("span",{className:"wou-muted",children:o.settingsRetentionHint}),v.retention_days?C("span",{className:"wou-field-error",role:"alert",children:v.retention_days}):null]}),de("div",{className:"wou-field",children:[C("span",{className:"wou-field-label",children:o.settingsModel}),C("p",{className:"wou-field-readonly",children:B.label}),C("p",{className:"wou-muted",children:o.settingsModelHint})]})]}):null]})]})]})}import{host as yg}from"@hermes/plugin-sdk";function $s(e,t){return t==null||e.some(n=>n.key===t)}function la(e){return!(!e.consented||!e.projectsFetchSucceeded||!e.tasksFetchSucceeded||e.offline||!$s(e.projects,e.projectKey))}function As(e,t){let n=e.filter(a=>(a.project?.key??null)===t);return{open:n.filter(a=>a.status==="open"),snoozed:n.filter(a=>a.status==="snoozed").length}}function _s(e){let t=new Map;for(let n of e){let a=t.get(n.chat_key)??[];a.push(n),t.set(n.chat_key,a)}return[...t].map(([n,a])=>({chatKey:n,tasks:a}))}function Ku(e,t){let n=As(e,t).open;return _s(n).flatMap(a=>a.tasks.map(s=>s.id))}function bg(e,t,n){return n==null||!Ku(e,t).includes(n)?null:e.find(a=>a.id===n)??null}function Wu(e,t){return la(t)?Ku(e,t.projectKey):[]}function Qu(e,t,n){return la(t)?bg(e,t.projectKey,n):null}import{Fragment as kg,jsx as Ge,jsxs as lt}from"react/jsx-runtime";function qu({projects:e,projectKey:t,onProjectChange:n,tasks:a,ready:s,offline:l,consented:c,projectsFetchSucceeded:p,tasksFetchSucceeded:d,projectsError:m,onRetryProjects:w,renderTask:f,onBack:h}){let _=$s(e,t),x=la({consented:c,projectsFetchSucceeded:p,tasksFetchSucceeded:d,offline:l,projects:e,projectKey:t})?As(a,t):{open:[],snoozed:0},b=_s(x.open);return lt("div",{className:"wou-settings-view",children:[lt("div",{className:"wou-settings-view-header",children:[Ge("button",{type:"button",className:"wou-link wou-settings-back",onClick:h,children:"Back"}),Ge("h2",{className:"wou-settings-view-title",children:"Catch up"})]}),lt("label",{className:"wou-field",children:[Ge("span",{children:"Hermes project"}),lt("select",{className:"wou-select",value:t??"",onChange:S=>n(S.target.value||null),children:[Ge("option",{value:"",children:"No project"}),_?null:Ge("option",{value:t,children:"Project unavailable"}),e.map(S=>lt("option",{value:S.key,children:[S.name," \xB7 ",S.profile]},S.key))]})]}),Ge("p",{className:"wou-muted",children:"All agents and tags in this project. Your list filters are unchanged."}),lt("section",{className:"wou-section","aria-labelledby":"wou-cu-chats",children:[lt("h3",{className:"wou-section-heading",id:"wou-cu-chats",children:["Waiting chats",s&&_&&!l?` (${b.length})`:""]}),l?Ge("p",{className:"wou-muted",role:"status",children:"Waiting chats could not be refreshed. Return to the list and retry."}):!s&&m?lt("p",{role:"alert",children:[m," ",Ge("button",{type:"button",className:"wou-link",onClick:w,children:o.retry})]}):s?_?lt(kg,{children:[b.length===0?Ge("p",{className:"wou-muted",role:"status",children:"No waiting chats in this project. Board cards have not been checked."}):null,b.map(S=>lt("div",{children:[S.tasks.length>1?Ge("h4",{children:S.tasks[0].chat_name||S.tasks[0].chat_title}):null,S.tasks.map(A=>f(A))]},S.chatKey)),x.snoozed>0?lt("p",{className:"wou-muted",children:[x.snoozed," snoozed ",x.snoozed===1?"ask is":"asks are"," hidden."]}):null]}):Ge("p",{className:"wou-muted",role:"status",children:"This project is no longer in the native catalog. Choose another project."}):Ge("p",{className:"wou-muted",role:"status",children:"Loading waiting chats\u2026"})]}),lt("section",{className:"wou-section","aria-labelledby":"wou-cu-human",children:[Ge("h3",{className:"wou-section-heading",id:"wou-cu-human",children:"Human-blocked cards"}),Ge("p",{className:"wou-muted",children:"Board cards are not available through the Hermes public plugin API. Answers, comments, and unblocking must be handled in Kanban."})]}),lt("section",{className:"wou-section","aria-labelledby":"wou-cu-review",children:[Ge("h3",{className:"wou-section-heading",id:"wou-cu-review",children:"Review cards"}),Ge("p",{className:"wou-muted",children:"Review cards have not been checked. Open Kanban to review them."})]}),Ge("button",{type:"button",className:"wou-link",onClick:()=>yg.navigate("/kanban"),children:"Open Kanban"}),Ge("p",{className:"wou-muted",children:"Opens Kanban only, not a specific board or card."})]})}import{useCallback as Vu,useEffect as Rs,useReducer as xg,useRef as Yu}from"react";import{jsx as xe,jsxs as kt}from"react/jsx-runtime";function vg(e){if(rn(e))return!0;let{status:t,error:n}=Ae(e);return t===404&&/open task not found/i.test(n)}function Xu({ctx:e,now:t,scanning:n,onBack:a,onAnswered:s}){let[l,c]=xg(Il,gs),p=Yu(null),d=Yu(0),m=()=>a(d.current),w=Dl(l),f=Vu(async()=>{c({type:"load"});try{c({type:"loaded",items:await On(e,Kr)})}catch{c({type:"loadFailed",error:o.teachLoadError})}},[e]);Rs(()=>{f()},[f]),Rs(()=>{p.current?.focus()},[]),Rs(()=>{if(l.status!=="done"||l.moreAvailable!==null)return;let v=!0;return On(e,1).then(x=>v&&c({type:"more",available:x.length>0})).catch(()=>v&&c({type:"more",available:!1})),()=>{v=!1}},[e,l.status,l.moreAvailable]);let h=Vu(async v=>{if(!(!w||l.busy)){c({type:"submit"});try{v==="skip"?(await eu(e,w.id),c({type:"skipped"})):(await Jl(e,w.id,v),d.current+=1,c({type:"answered"}),s(!0))}catch(x){if(vg(x)){c({type:"gone"}),s(!1);return}c({type:"submitFailed",error:Ae(x).error||o.teachSaveError})}}},[e,w,l.busy,s]);return kt("div",{className:"wou-settings-view wou-teach",ref:p,tabIndex:-1,onKeyDown:v=>{let x=v.target;if(x.tagName==="INPUT"||x.tagName==="TEXTAREA"||x.isContentEditable)return;if(v.key==="Escape"){v.preventDefault(),m();return}let b=Ol(v);b==null||!w||(v.preventDefault(),h(b))},"aria-labelledby":"wou-teach-title",children:[kt("div",{className:"wou-settings-view-header",children:[xe("button",{type:"button",className:"wou-link wou-settings-back",onClick:m,children:o.settingsBack}),xe("h2",{id:"wou-teach-title",className:"wou-settings-view-title",children:o.teachTitle}),w?xe("span",{className:"wou-muted wou-teach-progress","aria-live":"polite",children:Ml(l)}):null]}),l.status==="loading"?xe("p",{className:"wou-muted",role:"status",children:o.teachLoading}):null,l.status==="error"?kt("p",{role:"alert",children:[l.error??o.teachLoadError," ",xe("button",{type:"button",className:"wou-link",onClick:()=>{f()},children:o.retry})]}):null,l.status==="empty"?kt("div",{className:"wou-teach-end",children:[xe("p",{children:o.teachEmpty}),n?xe("p",{className:"wou-muted",children:o.firstRunTeachWait}):null,xe("p",{className:"wou-muted",children:o.teachEmptyNote}),xe("button",{type:"button",className:"wou-btn-compact",onClick:m,children:o.teachDone})]}):null,l.status==="done"?kt("div",{className:"wou-teach-end",role:"status",children:[xe("p",{children:l.sorted>0?o.teachFinished(l.sorted):o.teachFinishedNone}),kt("div",{className:"wou-teach-end-actions",children:[l.moreAvailable?xe("button",{type:"button",className:"wou-btn-compact",onClick:()=>{f()},children:o.teachMore}):null,xe("button",{type:"button",className:"wou-btn-compact",onClick:m,children:o.teachDone})]})]}):null,w?kt("div",{className:"wou-teach-card",children:[l.index===0&&l.sorted===0?xe("p",{className:"wou-muted wou-teach-intro",children:o.teachIntro}):null,xe("p",{className:"wou-teach-ask",children:w.ask}),w.context?xe("p",{className:"wou-teach-context",children:w.context}):null,kt("p",{className:"wou-muted wou-teach-meta",children:[xe("span",{children:Fl(w)}),xe(Ro,{dueAt:w.due_at,now:t})]}),xe("p",{className:"wou-muted wou-teach-filed",children:Ll(w.quadrant)}),xe("div",{className:"wou-teach-choices",role:"group","aria-label":o.teachTitle,children:ms.map(v=>kt("button",{type:"button",className:`wou-teach-choice wou-teach-choice-q${v.quadrant}${w.quadrant===v.quadrant?" wou-teach-choice-current":""}`,disabled:l.busy,onClick:()=>{h(v.quadrant)},"aria-keyshortcuts":String(v.quadrant),children:[xe("kbd",{className:"wou-keycap","aria-hidden":"true",children:v.quadrant}),xe("span",{className:"wou-teach-choice-label",children:v.label}),xe("span",{className:"wou-muted wou-teach-choice-hint",children:v.hint})]},v.quadrant))}),l.error?kt("p",{className:"wou-teach-error",role:"alert",children:[l.error," ",xe("span",{className:"wou-muted",children:o.teachSaveRetry})]}):null,kt("div",{className:"wou-teach-footer",children:[kt("button",{type:"button",className:"wou-btn-compact",disabled:l.busy,onClick:()=>{h("skip")},"aria-keyshortcuts":"S",children:[o.teachSkip," ",xe("kbd",{className:"wou-keycap","aria-hidden":"true",children:"S"})]}),xe("button",{type:"button",className:"wou-link",onClick:m,children:o.teachDone}),xe("span",{className:"wou-muted wou-teach-keys",children:o.teachKeysHint})]})]}):null]})}var Tg=/^(\S+) unreachable \(/,Sg=/; using \S+ list cached (.+)$/;function Zu(e,t={}){let n=[],a=new Set;for(let s of e??[]){let l=String(s).trim(),c=Tg.exec(l);if(!c)continue;let p=Sg.exec(l),d=c[1].toLowerCase();if(a.has(d))continue;a.add(d);let m=t[d]??c[1].charAt(0).toUpperCase()+c[1].slice(1);n.push({name:m,since:p?.[1]?.trim()||null})}return n}var Cg=/^(\S+): ([1-9]\d*) recent (?:chat uses|chats use) storage label "([A-Za-z0-9_.-]{1,32})"/;function Ju(e,t={}){let n=[],a=new Set;for(let s of e??[]){let l=Cg.exec(String(s).trim());if(!l)continue;let c=l[1].toLowerCase(),p=Number(l[2]);if(a.has(c)||!Number.isSafeInteger(p))continue;a.add(c);let d=t[c]??(c==="default"?null:l[1].charAt(0).toUpperCase()+l[1].slice(1));n.push({name:d,count:p,label:l[3]})}return n}function ec(e){return o.storageLabelWarning(e.name,e.count,e.label)}function tc(e){let t=e.failed??0;if(e.model_unreachable||e.succeeded===0&&t>0)return o.scanModelUnreachable;if(t<=0)return null;let n=(e.classification_errors?.[0]??e.errors?.[0])?.trim(),a=n?n.slice(0,120):"unknown error";return o.scanSomeChatsFailed(a)}function oc(e){return e.since?o.machineOfflineCached(e.name,e.since):o.machineOfflineNoCache(e.name)}function nc(e,t,n,a){return{...e,[t]:{token:a,label:n,animDone:!1,responseDone:!1}}}function rc(e,t,n){let a=e[t];if(!a||a.token!==n)return e;let s={...a,animDone:!0};if(s.responseDone){let l={...e};return delete l[t],l}return{...e,[t]:s}}function ac(e,t,n,a){let s=e[t];if(!s||s.token!==n)return e;let l={...s,responseDone:!0,label:a??s.label};if(l.animDone){let c={...e};return delete c[t],c}return{...e,[t]:l}}function sc(e,t,n){let a=e[t];if(!a||a.token!==n)return e;let s={...e};return delete s[t],s}function ic(e,t){return e[t]?.label}import{useEffect as Ng,useLayoutEffect as Pg,useRef as $g,useState as lc}from"react";import{jsx as Wn,jsxs as uc}from"react/jsx-runtime";function ua({label:e,buttonLabel:t,onOpen:n,children:a}){let[s,l]=lc(!1),[c,p]=lc(null),d=$g(null);return Pg(()=>{if(!s)return;let m=()=>{let w=d.current?.querySelector("button");if(!w)return;let f=w.getBoundingClientRect(),h=window.innerWidth,_=Math.min(Math.max(f.width,240),360,h-24),v=Math.max(12,Math.min(f.left,h-_-12));p({top:f.bottom+4,left:v,width:_})};return m(),window.addEventListener("resize",m),window.addEventListener("scroll",m,!0),()=>{window.removeEventListener("resize",m),window.removeEventListener("scroll",m,!0)}},[s]),Ng(()=>{if(!s)return;let m=f=>{let h=d.current;h&&!h.contains(f.target)&&l(!1)},w=f=>{f.key==="Escape"&&l(!1)};return document.addEventListener("mousedown",m),document.addEventListener("keydown",w),()=>{document.removeEventListener("mousedown",m),document.removeEventListener("keydown",w)}},[s]),uc("div",{className:"wou-project-filter-wrap",ref:d,children:[Wn("button",{type:"button",className:"wou-select wou-project-filter-btn","aria-label":e,title:e,"aria-haspopup":"true","aria-expanded":s,onClick:()=>{s||n?.(),l(m=>!m)},children:Wn("span",{className:"wou-project-filter-btn-label",children:t})}),s?Wn("div",{className:"wou-menu wou-project-filter-menu",style:c?{top:c.top,left:c.left,width:c.width}:{visibility:"hidden"},role:"group","aria-label":e,children:a}):null]})}function Io({checked:e,onChange:t,children:n}){return uc("label",{className:"wou-project-filter-row",children:[Wn("input",{type:"checkbox",checked:e,onChange:t}),Wn("span",{children:n})]})}import{jsx as Es,jsxs as pn}from"react/jsx-runtime";function Ag(e,t){if(e==="all")return o.projectFilterAll;if(e.length===1){let n=e[0];return n==="none"?o.projectFilterNone:t.find(a=>a.key===n)?.name??o.projectFilterMany(1)}return o.projectFilterMany(e.length)}function _g(e){let t=[];for(let n of e){let a=n.profile||"default",s=t.find(l=>l.profile===a);s||(s={profile:a,projects:[]},t.push(s)),s.projects.push(n)}return t}function cc({filter:e,projects:t,noProjectCount:n,onChange:a,onOpen:s}){let l=d=>e!=="all"&&e.includes(d),c=_g(t),p=c.length>1;return pn(ua,{label:o.projectFilterLabel,buttonLabel:Ag(e,t),onOpen:s,children:[Es(Io,{checked:e==="all",onChange:()=>a("all"),children:o.projectFilterAll}),pn(Io,{checked:l("none"),onChange:()=>a(Za(e,"none")),children:[o.projectFilterNone," ",pn("span",{className:"wou-filter-menu-count",children:["(",n,")"]})]}),t.length===0?Es("p",{className:"wou-filter-menu-hint",children:o.projectFilterEmpty}):null,c.map(d=>pn("div",{role:"presentation",children:[p?Es("div",{className:"wou-filter-menu-heading",children:d.profile}):null,d.projects.map(m=>pn(Io,{checked:l(m.key),onChange:()=>a(Za(e,m.key)),children:[m.name," ",pn("span",{className:"wou-filter-menu-count",children:["(",m.open_count??0,")"]})]},m.key))]},d.profile))]})}import{Fragment as Eg,jsx as ca,jsxs as da}from"react/jsx-runtime";function Rg(e,t){return e.length===0?o.tagFilterAll:e.length===1?t.find(n=>n.id===e[0])?.name??o.tagFilterMany(1):o.tagFilterMany(e.length)}function dc({filter:e,tags:t,onChange:n,onOpen:a}){return da(ua,{label:o.tagFilterLabel,buttonLabel:Rg(e,t),onOpen:a,children:[ca(Io,{checked:e.length===0,onChange:()=>n([]),children:o.tagFilterAll}),t.length===0?ca("p",{className:"wou-filter-menu-hint",children:o.tagFilterEmpty}):da(Eg,{children:[t.map(s=>da(Io,{checked:e.includes(s.id),onChange:()=>n(Xi(e,s.id)),children:[ca("span",{className:`wou-tag-dot ${Pt(s.color)}`,"aria-hidden":"true"})," ",s.name," ",da("span",{className:"wou-filter-menu-count",children:["(",s.open_count??0,")"]})]},s.id)),ca("p",{className:"wou-filter-menu-hint",children:o.tagFilterHint})]})]})}import{createContext as Bg,useContext as Hg}from"react";function Ue(e,t){if(t)return!t.profile&&!t.connection?{kind:"main",sessionId:t.session_id}:{kind:"profile",sessionId:t.session_id,profile:t.profile??"default",connection:t.connection,...t.connection_aliases?.length?{aliases:t.connection_aliases}:{}};if(!e.includes(":"))return{kind:"main",sessionId:e};let[n,a]=[e.slice(0,e.indexOf(":")),e.slice(e.indexOf(":")+1)];return/^\d{8}_\d{6}_[0-9a-f]+$|^[0-9a-f]{12}$|^local-[0-9a-f]{64}$/i.test(a)?{kind:"profile",sessionId:a,profile:n.toLowerCase(),connection:null}:{kind:"not-a-chat",source:e.split(":",1)[0]}}var Ig={mailhist:"support mail history",ntfy:"an ntfy alert"};function pc(e,t,n){let s=[`From Waiting On You (${Ig[e.toLowerCase()]??e}): ${t}`,""];for(let l of n){let c=l.ask.trim();if(!c)continue;let p=l.topic?.trim();s.push(`- ${p&&p!==t?`${p}: `:""}${c}`);let d=l.source_excerpt?.trim();if(d){s.push("  Source:");for(let w of d.split(`
`))s.push(`    ${w}`)}let m=(l.actions??[]).filter(w=>(w.kind??"run")==="run").map(w=>w.label);m.length>0&&s.push(`  Options on the card: ${m.join(", ")}`)}return s.push("","Help me handle this."),s.join(`
`)}function gc(e,t,n,a,s=[]){let l=t.trim().toLowerCase()||"default",c=e.filter(p=>(p.targetProfile||p.profile||"").toLowerCase()===l);if(n){for(let p of[n,...s]){let d=c.find(m=>m.connectionId===p);if(d)return d}return null}return(a?c.find(p=>p.connectionId===a):void 0)??c.find(p=>p.primary)??null}function Qn(e){let t=e?.trim();return(t||"default").toLowerCase()}function mc(e){let t=e.owner?.connectionId?.trim();return!!(t&&t!=="local"||Qn(e.owner?.profile)!=="default"||Qn(e.profile)!=="default")}function Dg(e){let t=new Set;e.connection&&t.add(e.connection);for(let n of e.aliases??[]){let a=n.trim();a&&t.add(a)}return t}function Mg(e,t){let n=Qn(t.owner?.profile??t.profile),a=Qn(e.profile);if(n!==a)return!1;let s=t.owner?.connectionId?.trim();if(!s||s==="local")return!e.connection;let l=Dg(e);return l.size===0?!0:l.has(s)}function fc(e,t){if(!t.sessionId||e.status==="done"||e.status==="dismissed")return!1;let n=Ue(e.chat_key,e.chat_target);return n.kind==="not-a-chat"||n.sessionId!==t.sessionId?!1:n.kind==="main"||!mc(t)?!0:Mg(n,t)}function wc(e,t){return!(!fc(e,t)||Ue(e.chat_key,e.chat_target).kind==="main"&&mc(t))}function Is(e,t,n){let a=e.filter(f=>fc(f,n));if(a.length===0)return null;let s=a[0].chat_key,l=a.filter(f=>f.chat_key===s),c=t.find(f=>f.chat_key===s),p=c?.quadrant??Math.min(...l.map(f=>f.quadrant)),d=l[0].agent,m=c?.project??l.find(f=>f.project)?.project??null,w=[];for(let f of l)for(let h of f.tags??[])w.some(_=>_.id===h.id)||w.push(h);return{chatKey:s,quadrant:p,agent:d,project:m,tags:w,kind:l.length>=2?"group":"task"}}function hc(e){if(!e.sessionId)return null;let t=Qn(e.owner?.profile??e.profile),n=e.owner?.connectionId?.trim()??"";return`${e.sessionId}\0${t}\0${n}`}function Lg(e,t,n,a=[]){return es(e,t,n,a)}function bc(e,t){if(!e)return null;for(let n of e){let a=n.entries.findIndex(s=>ds(s)===t);if(a>=0)return{section:n,index:a}}return null}function yc(e,t,n,a=15){let s={};Lg(e,n.agentFilter,n.projectFilter,n.tagFilter??[])||(s.agentFilter="all",s.projectFilter="all",s.tagFilter=[]),n.searchActive&&(s.closeSearch=!0);let l=bc(t,e.chatKey);if(l){let c=l.section.key;n.collapsed[c]&&(s.collapsed={...n.collapsed,[c]:!1}),l.index>=a&&!n.expandedSections[c]&&(s.expandedSections={...n.expandedSections,[c]:!0})}return e.kind==="group"&&n.groupExpanded[e.chatKey]===!1&&(s.groupExpanded={...n.groupExpanded,[e.chatKey]:!0}),s}function kc(e,t,n,a,s,l){if(!t)return n.some(d=>ds(d)===e.chatKey);let c=bc(t,e.chatKey);if(!c)return!1;let p=c.section.key;return l[p]?!1:s[p]?!0:c.index<a}var xc={caps:{busy:!1,awaitingResponse:!1,busyBySession:!1,focusedStoredSessionId:!1,focusedSessionId:!1},selection:{sessionId:null,profile:null,owner:null},busy:!1,awaitingResponse:!1,busyBySession:{},focusedSessionId:null};function pa(e){let t=e??{};return{busy:typeof t.busy<"u",awaitingResponse:typeof t.awaitingResponse<"u",busyBySession:typeof t.busyBySession<"u",focusedStoredSessionId:typeof t.focusedStoredSessionId<"u",focusedSessionId:typeof t.focusedSessionId<"u"}}function Og(e){return!e.caps.busy&&!(e.caps.busyBySession&&e.caps.focusedSessionId)?null:e.caps.busy?e.busy:e.caps.focusedSessionId&&e.focusedSessionId?!!e.busyBySession[e.focusedSessionId]:!1}function vc(e,t,n,a){if(Ue(e.chat_key,e.chat_target).kind==="not-a-chat")return[];let l=(e.chat_title||e.topic||e.chat_key).trim()||"chat";if(!wc(e,t.selection))return[];let p=a?.showReadUnavailable!==!1,d=[],m=Og(t);return m===!0&&d.push({kind:"working",label:n.presenceWorking,ariaLabel:n.presenceWorkingAria(l)}),!t.caps.awaitingResponse&&m===!0&&d.push({kind:"responded",label:n.presenceRespondedUnavailable,ariaLabel:n.presenceRespondedUnavailableAria,available:!1}),p&&m===!0&&d.push({kind:"read",label:n.presenceReadUnavailable,ariaLabel:n.presenceReadUnavailableAria,available:!1}),d}import{host as Bt,useValue as mo}from"@hermes/plugin-sdk";import{useMemo as zg}from"react";function Tc(e){let t=pa(e.capsState),n={sessionId:e.focusedStored??e.sessionActive,profile:e.profile,owner:e.owner};return{caps:t,selection:n,busy:e.busy,awaitingResponse:e.awaitingResponse,busyBySession:e.busyBySession,focusedSessionId:e.focusedRuntime}}var Fg=()=>()=>{};function Do(e){return{get:()=>e,subscribe:Fg}}var jg={},go={focusedStoredSessionId:Do(null),focusedSessionId:Do(null),focusedSessionProfile:Do(null),focusedSessionOwner:Do(null),busy:Do(!1),awaitingResponse:Do(!1),busyBySession:Do(jg)};function Sc(){let e=Bt.state.focusedStoredSessionId??go.focusedStoredSessionId,t=Bt.state.focusedSessionId??go.focusedSessionId,n=Bt.state.focusedSessionProfile??go.focusedSessionProfile,a=Bt.state.focusedSessionOwner??go.focusedSessionOwner,s=Bt.state.busy??go.busy,l=Bt.state.awaitingResponse??go.awaitingResponse,c=Bt.state.busyBySession??go.busyBySession,p=mo(e),d=mo(t),m=mo(Bt.state.activeSessionId),w=mo(n),f=mo(a),h=mo(s),_=mo(l),v=mo(c),x=pa(Bt.state);return zg(()=>Tc({capsState:Bt.state,focusedStored:p,focusedRuntime:d,sessionActive:m,profile:w,owner:f,busy:h,awaitingResponse:_,busyBySession:v}),[p,d,m,w,f,h,_,v,x.busy,x.awaitingResponse,x.busyBySession,x.focusedSessionId,x.focusedStoredSessionId])}import{jsx as Gg}from"react/jsx-runtime";var Cc=Bg(null);function Nc({children:e}){let t=Sc();return Gg(Cc.Provider,{value:t,children:e})}function Pc(){return Hg(Cc)??xc}import{useEffect as er,useLayoutEffect as dm,useRef as Oo,useState as Rt}from"react";import{useMemo as Ug}from"react";import{jsx as Ds}from"react/jsx-runtime";function gn({text:e,tokens:t,className:n}){let a=Ug(()=>kl(e,t),[e,t]);if(a.length===0)return Ds("span",{className:n,children:e});let s=[],l=0;for(let[c,p]of a)c>l&&s.push(e.slice(l,c)),s.push(Ds("mark",{className:"wou-search-mark",children:e.slice(c,p)},c)),l=p;return l<e.length&&s.push(e.slice(l)),Ds("span",{className:n,children:s})}import{host as Mo}from"@hermes/plugin-sdk";function Ms(e){return e instanceof Error?e.message:String(e)}function Kg(e,t){return new Promise((n,a)=>{let s=setTimeout(()=>a(new Error(`timed out after ${t}ms`)),t);e.then(l=>{clearTimeout(s),n(l)},l=>{clearTimeout(s),a(l)})})}var Wg=e=>new Promise(t=>setTimeout(t,e));async function Qg(e,t,n,a,s){e("/");let l=t?.setDraft,c=t?.getDraft;if(typeof l!="function"||typeof c!="function")throw new Error("could not fill the new chat");let p=async()=>{let d=await c("new");return typeof d=="string"&&d.trim()?(s(),!0):!1};if(!await p()){for(let d=0;d<15;d++){if(await Wg(d===0?50:150),await p())return;if(await l("new",n)){a();return}}throw new Error("could not fill the new chat")}}async function $c(e){let t=Mo.openSession;typeof t=="function"?await t(e,{intent:"in-place"}):Mo.navigate(`/${e}`)}async function eo(e,t,n,a,s=[]){let l=Ue(t,a),c=Mo,p=c.openSession;try{if(l.kind==="not-a-chat"){await Qg(w=>Mo.navigate(w),c.composer,pc(l.source,n,s),()=>ae(o.chatContextReady),()=>ae(o.chatNewDraftBlocked));return}if(l.kind==="main"){typeof p=="function"?await p(l.sessionId,{intent:"in-place"}):Mo.navigate(`/${l.sessionId}`);return}let d=null;if(typeof c.profileRoutes=="function"){let w=await Kg(c.profileRoutes(),3e3).catch(f=>(ae(`Could not list profile routes (${Ms(f)}); trying defaults.`),[]));d=gc(w,l.profile,l.connection,Mo.state.connectionId.get(),l.aliases)}if(typeof p!="function"){Mo.navigate(`/${l.sessionId}`);return}let m={intent:"window",profile:l.profile};d&&(m.route=d),await p(l.sessionId,m)}catch(d){console.warn("[waiting-on-you] open chat failed",{chatKey:t,target:a,error:Ms(d)}),ue(o.chatOpenFailed(n,Ms(d)),JSON.stringify({chatKey:t,target:a}))}}import{jsx as Ac,jsxs as _c}from"react/jsx-runtime";function ga({onClick:e}){return _c("button",{type:"button",className:"wou-link wou-chat-link wou-open-session-link",onClick:e,children:[o.openSession,Ac(Fn,{className:"wou-external-link-icon"})]})}function ma({agent:e,onClick:t}){return _c("button",{type:"button",className:"wou-link wou-chat-link wou-open-session-link",onClick:t,children:[o.handleWithAgent(e),Ac(Fn,{className:"wou-external-link-icon"})]})}import{useEffect as Yg,useRef as Ls}from"react";function Rc(e){return!(!e||e.closest(".wou-group-children")||e.closest('button, a, input, textarea, select, [role="menu"], [role="alertdialog"]'))}function Ec(e){return!e.pending&&!e.confirmClose&&!e.renameOpen&&!e.aiQuick&&!e.customSnoozeOpen&&!e.checkboxDisabled}function Ic(e,t,n,a){return e!=="F10"||!t?!1:n===a}function Dc(e){return e?"done-all":"confirm"}function Mc(e,t,n){e==="done-all"?n():t()}function Lc(e,t,n){return e==="Escape"?{action:"escape"}:e==="Tab"?{action:"tab-dismiss"}:e==="Enter"&&n?{action:"activate",altKey:t}:null}import{useLayoutEffect as qg,useState as Vg}from"react";var qn=8,Vn=4;function fa(e,t,n){let[a,s]=Vg(null);return qg(()=>{if(!e){s(null);return}let l=()=>{let c=t.current,p=n.current;if(!c||!p)return;let d=p.getBoundingClientRect(),m=window.innerWidth,w=window.innerHeight,f=c.style.maxHeight;c.style.maxHeight="none";let h=c.scrollHeight,_=c.offsetWidth;c.style.maxHeight=f;let v=w-d.bottom-Vn-qn,x=d.top-Vn-qn,b,S;h<=v?b=d.bottom+Vn:h<=x?b=d.top-Vn-h:v>=x?(b=d.bottom+Vn,S=v):(b=qn,S=x);let A=Math.max(qn,Math.min(d.right-_,m-_-qn));s({top:b,left:A,maxHeight:S})};return l(),window.addEventListener("resize",l),window.addEventListener("scroll",l,!0),()=>{window.removeEventListener("resize",l),window.removeEventListener("scroll",l,!0)}},[e,t,n]),a}import{jsx as mn,jsxs as Xg}from"react/jsx-runtime";function Oc({open:e,onClose:t,menuRef:n,anchorRef:a,onConfirmClose:s,onDoneAll:l}){let c=fa(e,n,a),p=Ls(t);p.current=t;let d=Ls(s);d.current=s;let m=Ls(l);m.current=l;let w=f=>{p.current("activate"),Mc(Dc(f),d.current,m.current)};return Yg(()=>{if(!e)return;let f=n.current;if(!f)return;let h=()=>f.querySelector("button.wou-menu-row"),_=requestAnimationFrame(()=>h()?.focus()),v=x=>{let b=h(),S=!!(b&&document.activeElement===b),A=Lc(x.key,x.altKey,S);if(A){if(A.action==="escape"){x.preventDefault(),p.current("escape");return}if(A.action==="tab-dismiss"){p.current("tab");return}A.action==="activate"&&(x.preventDefault(),w(A.altKey))}};return f.addEventListener("keydown",v),()=>{cancelAnimationFrame(_),f.removeEventListener("keydown",v)}},[e,n]),e?mn("div",{className:"wou-menu wou-menu-floating wou-menu-notion",style:c??{visibility:"hidden"},ref:n,role:"menu","aria-label":o.closeAllTasks,children:Xg("button",{type:"button",role:"menuitem",className:"wou-menu-row",title:o.groupCheckboxTip,onClick:f=>w(f.altKey),children:[mn("span",{className:"wou-menu-row-icon","aria-hidden":"true",children:mn(nn,{})}),mn("span",{className:"wou-menu-row-label",children:o.closeAllTasks}),mn("span",{className:"wou-menu-row-trail",children:mn("kbd",{className:"wou-menu-kbd",children:o.renameAltHint})})]})}):null}import{useEffect as Fc,useRef as Zg,useState as Jg}from"react";import{Fragment as jc,jsx as Q,jsxs as wa}from"react/jsx-runtime";var em=[1,2,3,4];function fn(){return Q("div",{className:"wou-menu-sep",role:"presentation"})}function Os({children:e}){return Q("div",{className:"wou-menu-section",role:"presentation",children:e})}function _t({icon:e,label:t,trailing:n,danger:a,onActivate:s,role:l="menuitem","aria-checked":c,altAction:p,title:d}){return wa("button",{type:"button",role:l,"aria-checked":c,"data-alt-action":p,title:d,className:`wou-menu-row${a?" wou-menu-row-danger":""}`,onClick:m=>s({altKey:m.altKey}),children:[Q("span",{className:"wou-menu-row-icon","aria-hidden":"true",children:e}),Q("span",{className:"wou-menu-row-label",children:t}),n?Q("span",{className:"wou-menu-row-trail",children:n}):null]})}function tm({quadrant:e}){return Q("span",{className:`wou-menu-priority-sq wou-quadrant-dot-${e}`,"aria-hidden":"true"})}function ha({open:e,onClose:t,menuRef:n,anchorRef:a,quadrant:s,tags:l,tagState:c,showWhyHere:p,hidePriority:d=!1,onRename:m,onRenameWithAi:w,onSnoozeTomorrow:f,onSnoozeMonday:h,onSnoozeWeek:_,onCustomSnooze:v,onToggleTag:x,onNewTag:b,onQuadrant:S,onWhyHere:A,onCloseAll:F,onCloseAllNow:te,onDismiss:pe,dismissLabel:re}){let R=fa(e,n,a),Y=Zg(t);Y.current=t;let[Z,G]=Jg(!1);if(Fc(()=>{if(!e||!w){G(!1);return}let z=Ee=>G(Ee.altKey),le=()=>G(!1);return window.addEventListener("keydown",z,!0),window.addEventListener("keyup",z,!0),window.addEventListener("mousemove",z,!0),window.addEventListener("blur",le),()=>{window.removeEventListener("keydown",z,!0),window.removeEventListener("keyup",z,!0),window.removeEventListener("mousemove",z,!0),window.removeEventListener("blur",le)}},[e,w]),Fc(()=>{if(!e)return;let z=n.current;if(!z)return;let le=()=>Array.from(z.querySelectorAll("button.wou-menu-row")),Ee=he=>{let X=le();if(X.length===0)return;let be=(he%X.length+X.length)%X.length;X[be]?.focus()},He=requestAnimationFrame(()=>Ee(0)),Ne=he=>{if(he.key==="Escape"){Y.current();return}let X=le();if(X.length===0)return;let be=document.activeElement,q=X.findIndex(E=>E===be);if(he.key==="ArrowDown")he.preventDefault(),Ee(q<0?0:q+1);else if(he.key==="ArrowUp")he.preventDefault(),Ee(q<0?X.length-1:q-1);else if(he.key==="Enter"&&q>=0){he.preventDefault();let E=X[q];he.altKey&&E?.dataset.altAction==="rename-ai"?E.dispatchEvent(new MouseEvent("click",{bubbles:!0,altKey:!0})):E?.click()}};return z.addEventListener("keydown",Ne),()=>{cancelAnimationFrame(He),z.removeEventListener("keydown",Ne)}},[e,n]),!e)return null;let j=()=>t();return wa("div",{className:"wou-menu wou-menu-floating wou-menu-notion",style:R??{visibility:"hidden"},ref:n,role:"menu",children:[F?Q(_t,{icon:Q(nn,{}),label:o.closeAllTasks,trailing:Q("kbd",{className:"wou-menu-kbd",children:o.renameAltHint}),title:o.groupCheckboxTip,onActivate:z=>{j(),te&&(z.altKey||Z)?te():F()}}):null,F?Q(fn,{}):null,Q(_t,{icon:Z?Q(uo,{}):Q(iu,{}),label:Z?o.renameWithAi:o.rename,trailing:w&&!Z?Q("kbd",{className:"wou-menu-kbd",children:o.renameAltHint}):void 0,altAction:w?"rename-ai":void 0,title:w?o.renameWithAiTip:void 0,onActivate:z=>{j(),w&&(z.altKey||Z)?w():m()}}),Q(fn,{}),Q(Os,{children:o.menuSectionSnooze}),Q(_t,{icon:Q(lu,{}),label:o.snoozeTomorrowShort,onActivate:()=>{j(),f()}}),Q(_t,{icon:Q(uu,{}),label:o.snoozeMondayShort,onActivate:()=>{j(),h()}}),Q(_t,{icon:Q(cu,{}),label:o.snoozeWeekShort,onActivate:()=>{j(),_()}}),Q(_t,{icon:Q(du,{}),label:o.snoozeCustomShort,onActivate:()=>{j(),v()}}),Q(fn,{}),Q(Os,{children:o.menuSectionTags}),l.length>0?Q("div",{className:`wou-menu-tag-list${l.length>6?" wou-menu-tag-list-scroll":""}`,role:"presentation",children:l.map(z=>{let le=c(z.id);return Q(_t,{role:"menuitemcheckbox","aria-checked":le==="all"?!0:le==="some"?"mixed":!1,icon:Q("span",{className:`wou-tag-dot ${Pt(z.color)}`}),label:z.name,trailing:le==="all"?Q(nn,{}):le==="some"?Q("span",{className:"wou-menu-tag-check",children:"\u2013"}):void 0,onActivate:()=>x(z,le)},z.id)})}):null,Q(_t,{icon:Q(pu,{}),label:o.tagNew,onActivate:()=>{j(),b()}}),d?null:wa(jc,{children:[Q(fn,{}),Q(Os,{children:o.menuSectionPriority}),em.map(z=>Q(_t,{role:"menuitemradio","aria-checked":z===s,icon:Q(tm,{quadrant:z}),label:o[`quadrantBar${z}`],trailing:z===s?Q(nn,{}):void 0,onActivate:()=>{z!==s&&(j(),S(z))}},z))]}),p?wa(jc,{children:[Q(fn,{}),Q(_t,{icon:Q(gu,{}),label:o.whyHere,onActivate:()=>{j(),A()}})]}):null,Q(fn,{}),Q(_t,{icon:Q(mu,{}),label:re,danger:!0,onActivate:()=>{j(),pe()}})]})}import{useEffect as va,useRef as Hs,useState as Ht}from"react";import{useState as zc}from"react";import{jsx as ba,jsxs as Bc}from"react/jsx-runtime";function Hc({ctx:e,task:t,excerptOpen:n,onToggleExcerpt:a,onReload:s,disabled:l=!1}){let c=t.actions??[],[p,d]=zc(null),[m,w]=zc(null);if(c.length===0)return null;let f=p!=null,h=l||f,_=async b=>{d(b.id),w(null);try{let S=await Ql(e,t.id,b.id);S.ok?(ae(S.message),s()):ue(S.message)}catch(S){let A=S instanceof Error?S.message:String(S);ue(A)}finally{d(null)}},v=b=>{if(h)return;if((b.kind??"run")==="details"){a(!n);return}if(b.confirm?.trim()){w(b.id);return}_(b)},x=c.find(b=>b.id===m);return Bc("div",{className:"wou-card-actions",children:[c.map(b=>{let S=b.kind??"run",A=b.style??"default",F=p===b.id,te=["wou-action-btn",A==="primary"?"wou-action-btn-primary":"",A==="danger"?"wou-action-btn-danger":""].filter(Boolean).join(" "),pe=F?`${b.label}${o.actionRunningSuffix}`:b.label;return ba("button",{type:"button",className:te,disabled:h,"aria-pressed":S==="details"&&n||void 0,onClick:()=>v(b),children:pe},b.id)}),x?.confirm?Bc("div",{className:"wou-action-confirm",role:"alertdialog",children:[ba("span",{className:"wou-action-confirm-text",children:x.confirm}),ba("button",{type:"button",className:"wou-action-btn wou-action-btn-primary",disabled:h,onClick:()=>{_(x)},children:o.yes}),ba("button",{type:"button",className:"wou-action-btn",disabled:h,onClick:()=>w(null),children:o.renameCancel})]}):null]})}import{useEffect as Yc,useRef as Xc,useState as Zc}from"react";var Fs=4e3;function om(e,t){let n=Math.min(Math.max(t,0),e.length);return n>0&&e.charCodeAt(n-1)>=55296&&e.charCodeAt(n-1)<=56319&&(n-=1),e.slice(0,n)}var Gc=5e3,nm=[/^(say|reply|answer|decide|confirm|check|let \w+ know)\s+(whether|if)\b/,/^tell(\s+[\w’'-]+){0,3}\s+(whether|if)\b/,/^(say|reply|answer)\s+(yes|no|ok|okay|go|ship)\b/,/^(approve|confirm|ok|okay|allow|authorize|authorise|green-?light|sign off on)\b/,/^(should|shall|can|could|may|do|does|did|is|are|was|will|would|want)\b.*\?$/];function Yn(e){let t=e.trim().replace(/\s+/g," ").toLowerCase().replace(/\byes or no\b/g,"yes-no");return!t||/\bor\b/.test(t)||/^(which|what|who|when|where|how|why)\b/.test(t)?!1:nm.some(n=>n.test(t))}function Uc(e,t,n=""){let a;if(e==="yes")a="Yes.";else if(e==="no")a="No.";else if(a=om(n.trim(),Fs).trim(),!a)return null;let s=t.trim().replace(/\s+/g," ");return s?`${a}

(Answering from Waiting On You: \u201C${s}\u201D)`:a}var rm={y:"yes",n:"no",r:"reply",l:"later",o:"open",j:"next",arrowdown:"next",k:"prev",arrowup:"prev"};function Kc(e){return e.typing||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey?null:rm[e.key.toLowerCase()]??null}function Wc(e,t,n){if(e.length===0)return null;let a=t==null?-1:e.indexOf(t);return a<0?n===1?e[0]:e[e.length-1]:e[Math.min(e.length-1,Math.max(0,a+n))]}function Qc(e,t,n){if(n==null)return null;if(t.includes(n))return n;if(t.length===0)return null;let a=new Set(t),s=e.indexOf(n);if(s>=0){for(let l=s+1;l<e.length;l++)if(a.has(e[l]))return e[l];for(let l=s-1;l>=0;l--)if(a.has(e[l]))return e[l]}return t[0]}function js(e){let t=e.composer;return!!(t&&typeof t.getDraft=="function"&&typeof t.submit=="function")}function qc(e,t){let n=e?.trim();return{profile:(t?.trim()||"default").toLowerCase(),connectionId:n&&n!=="local"?n:null}}function Xn(e,t){return e.profile===t.profile&&e.connectionId===t.connectionId}async function am(e,t,n){if(e.shownSessionId()!==n)return!1;let a=await t.getDraft(n);return a==null?!1:a===""?!0:await t.getDraft(null)===a&&e.shownSessionId()===n}async function Vc(e,t,n){let a=e.composer;if(!n.trim()||!t||!a||!js({composer:a}))return!1;let s=a,l=()=>e.signal?.aborted===!0,c=()=>e.inScope==null||e.inScope(),p=async()=>l()||!c()||!await am(e,s,t)||l()||!c()?!1:s.submit(t,n);if(await p())return!0;if(l()||!c())return!1;await e.openInPlace(t);let d=Math.max(1,Math.ceil(e.timeoutMs/e.pollMs));for(let m=0;m<d;m++){if(l()||!c()||(await e.sleep(e.pollMs),l()||!c()))return!1;if(await p())return!0}return!1}function Zn(e,t,n={profile:"default",connectionId:null}){return!t||e.status!=="open"||n.profile!=="default"||Jn(e)?!1:Ue(e.chat_key,e.chat_target).kind==="main"}function Jn(e){return e.status!=="open"?null:Ue(e.chat_key,e.chat_target).kind==="profile"?"other-window":null}import{Fragment as sm,jsx as ut,jsxs as Lo}from"react/jsx-runtime";function Jc({task:e,controls:t,visible:n,canAnswer:a,yesNo:s,openLabel:l,unsupportedNote:c=null,onDone:p,disabled:d=!1}){let[m,w]=Zc(!1),[f,h]=Zc(""),_=Xc(null),v=t.phase(e.id),x=t.replyRequest,b=Xc(x?.n??0);if(Yc(()=>{!x||x.n<=b.current||(b.current=x.n,x.taskId===e.id&&a&&w(!0))},[x?.n,x?.taskId,e.id,a]),Yc(()=>{if(!m)return;let F=_.current;F&&(F.focus({preventScroll:!0}),F.scrollIntoView({block:"nearest"}))},[m]),v){let F=t.answerLabel(e.id)??"";return Lo("div",{className:"wou-answer-pending",role:"status",children:[ut("span",{children:v==="waiting"?o.answerWaiting(F):o.answerSending(F)}),v==="waiting"?ut("button",{type:"button",className:"wou-action-btn",onClick:()=>t.cancel(e),children:o.answerUndo}):null]})}if(!n)return null;let S=()=>{w(!1),h("")},A=()=>{f.trim()&&(t.answer(e,"reply",f),S())};return Lo("div",{className:"wou-answer",role:"group","aria-label":o.answerBarRegion,children:[Lo("div",{className:"wou-answer-bar",children:[a&&s?Lo(sm,{children:[ut("button",{type:"button",className:"wou-action-btn wou-answer-yes",title:o.answerYesTip,disabled:d,onClick:()=>t.answer(e,"yes"),children:o.answerYes}),ut("button",{type:"button",className:"wou-action-btn wou-answer-no",title:o.answerNoTip,disabled:d,onClick:()=>t.answer(e,"no"),children:o.answerNo})]}):null,a?ut("button",{type:"button",className:"wou-action-btn",title:o.answerReplyTip,"aria-expanded":m,disabled:d,onClick:()=>m?S():w(!0),children:o.answerReply}):null,p?ut("button",{type:"button",className:"wou-action-btn",title:o.answerDoneTip,disabled:d,onClick:p,children:o.answerDone}):null,ut("button",{type:"button",className:"wou-action-btn",title:o.answerLaterTip,disabled:d,onClick:()=>t.later(e),children:o.answerLater}),Lo("button",{type:"button",className:"wou-action-btn wou-answer-open",title:c?`${o.answerOpenTip}. ${c}`:o.answerOpenTip,"aria-describedby":c?`wou-answer-unsupported-${e.id}`:void 0,onClick:()=>t.open(e),children:[l,ut(Fn,{className:"wou-external-link-icon"})]})]}),c?ut("p",{className:"wou-answer-unsupported",id:`wou-answer-unsupported-${e.id}`,role:"note",children:c}):null,m&&a?Lo("form",{className:"wou-answer-reply",onSubmit:F=>{F.preventDefault(),A()},children:[ut("textarea",{ref:_,className:"wou-answer-reply-input","aria-label":o.answerReplyLabel,placeholder:o.answerReplyPlaceholder,value:f,maxLength:Fs,rows:2,disabled:d,onChange:F=>h(F.target.value),onKeyDown:F=>{if(F.key==="Escape"){F.preventDefault(),F.stopPropagation(),S();return}F.key==="Enter"&&!F.shiftKey&&!F.nativeEvent.isComposing&&(F.preventDefault(),A())}}),Lo("div",{className:"wou-answer-reply-actions",children:[ut("button",{type:"submit",className:"wou-action-btn wou-action-btn-primary",disabled:d||!f.trim(),children:o.answerReplySend}),ut("button",{type:"button",className:"wou-action-btn",onClick:S,children:o.answerReplyCancel}),ut("span",{className:"wou-muted wou-answer-reply-hint",children:o.answerReplyHint})]})]}):null]})}import{createContext as im,useContext as lm}from"react";var zs=im(null);function ya(){return lm(zs)}import{useCallback as ed,useEffect as um,useRef as Bs,useState as td}from"react";function ka(e,t){let[n,a]=td(!1),[s,l]=td(null),c=Bs(0),p=Bs(!0),d=Bs(t);d.current=t,um(()=>(p.current=!0,()=>{p.current=!1,c.current+=1}),[]);let m=ed(()=>{c.current+=1,a(!1),l(null)},[]),w=ed(async()=>{let f=++c.current;a(!0),l(null);try{let h=(await Wl(e,d.current)).trim();return!p.current||f!==c.current?null:h||(l(o.renameWithAiFailed),null)}catch(h){return!p.current||f!==c.current||l(Ae(h).error||o.renameWithAiFailed),null}finally{p.current&&f===c.current&&a(!1)}},[e]);return{busy:n,error:s,setError:l,generate:w,cancel:m}}import{jsx as od}from"react/jsx-runtime";var cm={presenceWorking:o.presenceWorking,presenceWorkingAria:o.presenceWorkingAria,presenceResponded:o.presenceResponded,presenceRespondedAria:o.presenceRespondedAria,presenceRespondedUnavailable:o.presenceRespondedUnavailable,presenceRespondedUnavailableAria:o.presenceRespondedUnavailableAria,presenceReadUnavailable:o.presenceReadUnavailable,presenceReadUnavailableAria:o.presenceReadUnavailableAria};function xa({task:e,showReadUnavailable:t=!0}){let n=Pc(),a=vc(e,n,cm,{showReadUnavailable:t});return a.length===0?null:od("span",{className:"wou-chat-presence",role:"group","aria-label":o.presenceGroupAria,children:a.map(s=>od("span",{className:`wou-chat-presence-item wou-muted${s.kind==="working"?" wou-chat-presence-working":""}${s.kind!=="working"&&"available"in s&&!s.available?" wou-chat-presence-na":""}`,role:"status","aria-label":s.ariaLabel,children:s.label},s.kind))})}import{jsx as W,jsxs as xt}from"react/jsx-runtime";function wn({ctx:e,task:t,allTags:n,nameAfterChat:a=!1,closed:s,nested:l,groupTitle:c,pendingLabel:p,checkboxDisabled:d,onDone:m,onDismiss:w,onSnooze:f,onMoveQuadrant:h,onToggleTag:_,onCreateTag:v,onProjectClick:x,onRename:b,onReopen:S,onReload:A,highlightTokens:F=[],followHighlighted:te=!1,showProjectChips:pe=!1,showPriorities:re=!0,showAgentChip:R=!0,defaultDetailsOpen:Y=!1,inNextUp:Z=!1,updatedNow:G=new Date}){let j=ya(),[z,le]=Ht(!1),[Ee,He]=Ht(Y),[Ne,he]=Ht(!1),X=t.source_excerpt?.trim()??"",[be,q]=Ht(!1),[E,J]=Ht(!1),[Pe,Ie]=Ht(!1),[$e,De]=Ht(""),[_e,ee]=Ht(()=>en(new Date)),[Te,se]=Ht(null),N=Hs(null),B=Hs(null),ge=Hs(null),ye=!!p,I=Co(t,a,!!l),ie=ka(e,{task_id:t.id}),[Me,y]=Ht(!1);va(()=>{if(!E)return;let M=ge.current;M&&(M.focus(),M.select())},[E]),va(()=>{if(!z)return;let M=Fe=>{let Wt=Fe.target;B.current?.contains(Wt)||N.current?.contains(Wt)||le(!1)};return document.addEventListener("mousedown",M),()=>document.removeEventListener("mousedown",M)},[z]),va(()=>{if(!z&&!be&&!E)return;let M=Fe=>{Fe.key==="Escape"&&(le(!1),q(!1),E&&(ie.cancel(),J(!1),De(I)),se(null))};return document.addEventListener("keydown",M),()=>document.removeEventListener("keydown",M)},[z,be,E,I]);let H=async()=>{await eo(e,t.chat_key,t.chat_title,t.chat_target,[t])},me=Xt(new Date),Le=Dn(Math.floor(Date.now()/1e3)),ke=()=>{le(!1),ee(en(new Date)),se(null),q(!0)},et=()=>{le(!1),ie.cancel(),y(!1),De(I),J(!0)},ct=()=>{ie.cancel(),J(!1),De(I)},ho=async()=>{if(ie.busy)return;let M=await ie.generate();M&&(De(M),requestAnimationFrame(()=>{let Fe=ge.current;Fe&&(Fe.focus(),Fe.select())}))},Ut=async()=>{if(le(!1),!ie.busy){y(!0);try{let M=await ie.generate();if(!M)return;if((t.title_override?.trim()||(l?"":t.chat_name?.trim())||"")===M){ae(o.renameWithAiSame);return}b(t,M)}finally{y(!1)}}};va(()=>{!Me&&ie.error&&!E&&(ue(o.renameWithAiFailed,ie.error),ie.setError(null))},[Me,ie.error,E]);let Et=()=>{let M=xl($e,I,t.title_override);if(M.action==="close"){J(!1);return}J(!1),b(t,M.value??null)},bo=()=>{let M=jr(_e),Fe=Math.floor(Date.now()/1e3);if(M==null||M<=Fe){se(o.snoozePast);return}q(!1),se(null),f(t,M)},Ye=!l&&re,dt=pe&&!l,oo=Xa(t),no=l?"":zr(oo,G),pt=l?"":Br(oo),Qe=I.trim(),vt=l&&!E&&(!Qe||c!=null&&Qe.toLowerCase()===c.trim().toLowerCase()),It=t.ask.trim(),Kt=It.length>60?`${It.slice(0,60).trimEnd()}\u2026`:It,ro=dt&&t.project?W(ta,{project:t.project,onClick:x}):null,gt=wt(t),mt=t.context?.trim()??"",xn=R||!!ro||gt.length>0||!!s||t.due_at!=null,Dt=Ue(t.chat_key,t.chat_target).kind==="not-a-chat",Tt=!!j&&!s&&j?.activeId===t.id,St=j&&!s?W(Jc,{task:t,controls:j,visible:!ye&&!E&&(Z||Tt||j.showAll),canAnswer:Zn(t,j.canSubmit),yesNo:Yn(t.ask),openLabel:Dt?o.handleWithAgent(t.agent):o.openSession,unsupportedNote:Jn(t)?o.answerUnsupported:null,onDone:Z?()=>m(t):void 0,disabled:ye||!!d}):null,at=Dt?W(ma,{agent:t.agent,onClick:()=>{H()}}):W(ga,{onClick:()=>{H()}}),zo=!s&&(t.actions?.length??0)>0&&A?W(Hc,{ctx:e,task:t,excerptOpen:Ne,onToggleExcerpt:he,onReload:A,disabled:ye||E}):null,yo=E?xt("div",{className:"wou-inline-rename",children:[W("input",{ref:ge,type:"text",className:"wou-inline-rename-input wou-topic",value:$e,maxLength:120,placeholder:I,disabled:ie.busy,onChange:M=>De(M.target.value),onKeyDown:M=>{M.key==="Enter"&&(M.preventDefault(),ie.busy||Et()),M.key==="Escape"&&(M.preventDefault(),ct())}}),xt("div",{className:"wou-inline-rename-actions",children:[W("button",{type:"button",className:"wou-inline-rename-save",disabled:ie.busy,onClick:()=>Et(),children:o.renameSave}),xt("button",{type:"button",className:"wou-inline-rename-ai",disabled:ie.busy,"aria-busy":ie.busy,title:o.renameWithAiTip,onClick:()=>{ho()},children:[W(uo,{}),W("span",{children:ie.busy?o.renameWithAiBusy:o.renameWithAi})]}),W("button",{type:"button",onClick:()=>ct(),children:o.renameCancel}),W("span",{className:"wou-inline-rename-hint",children:o.renameKeyboardHint})]}),ie.error?W("p",{className:"wou-inline-rename-error",role:"alert",children:ie.error}):null]}):vt?null:W("span",{className:"wou-topic",children:W(gn,{text:I,tokens:F})}),ko=!s&&!ye?xt("div",{className:"wou-menu-anchor",style:{position:"relative"},ref:B,children:[W("button",{type:"button",className:l?"wou-icon wou-icon-nested":"wou-icon","aria-label":l?o.menuMoreForAsk(Kt):o.menuMore,"aria-expanded":z,"aria-haspopup":"menu",disabled:E||Me,onClick:()=>le(M=>!M),children:"\u2026"}),W(ha,{open:z,onClose:()=>le(!1),menuRef:N,anchorRef:B,quadrant:t.quadrant,tags:n,tagState:M=>Hr([t],M),showWhyHere:!!X,hidePriority:!Ye,onRename:et,onRenameWithAi:()=>{Ut()},onSnoozeTomorrow:()=>f(t,me.tomorrow),onSnoozeMonday:()=>f(t,me.nextMonday),onSnoozeWeek:()=>f(t,me.inWeek),onCustomSnooze:ke,onToggleTag:(M,Fe)=>_(t,M,Fe),onNewTag:()=>Ie(!0),onQuadrant:M=>h(t,M),onWhyHere:()=>he(M=>!M),onDismiss:()=>w(t),dismissLabel:o.notATask})]}):null;return xt("div",{className:`wou-row${l?" wou-row-nested":""}${s?" wou-closed-row":""}${ye?" wou-row-pending":""}${z?" wou-row-menu-open":""}${E?" wou-row-rename-open":""}${te&&!l?" wou-row-follow-selected":""}${Tt?" wou-row-active":""}`,"data-rename-open":E?"true":void 0,"data-wou-follow-key":l?void 0:t.chat_key,"data-wou-task-id":j&&!s?t.id:void 0,"aria-current":Tt?"true":void 0,tabIndex:j&&!s?-1:void 0,onClick:j&&!s?()=>j.activate(t):void 0,children:[s?null:W("input",{type:"checkbox","aria-label":o.markDone(I),disabled:d||ye||E,onChange:()=>{d||ye||E||m(t)}}),xt("div",{className:"wou-row-body",children:[l?yo:xt("div",{className:"wou-card-title-line",children:[W("div",{className:"wou-card-title-main",children:yo}),no?W("span",{className:"wou-updated-at wou-muted",title:pt,children:no}):null,!l&&!s&&!Dt?W(xa,{task:t}):null,!s&&!E&&!j?W("span",{className:"wou-session-slot",children:at}):null,ko]}),mt?W("button",{type:"button",className:`wou-ask wou-ask-toggle${vt&&!E?" wou-ask-only":""}`,"aria-expanded":Ee,title:Ee?o.askHideDetails:o.askShowDetails,onClick:()=>He(M=>!M),children:W(gn,{text:t.ask,tokens:F})}):W("div",{className:`wou-ask${vt&&!E?" wou-ask-only":""}`,children:W(gn,{text:t.ask,tokens:F})}),t.status==="expired"?W("p",{className:"wou-muted",children:o.statusExpired}):null,mt&&Ee?W("div",{className:"wou-task-context wou-task-context-open",children:mt}):null,!l&&xn?xt("div",{className:"wou-meta",children:[R?W("span",{className:"wou-agent-chip",children:t.agent}):null,s?null:W(Ro,{dueAt:t.due_at,now:G}),ro,W(Un,{tags:gt}),s?at:null,s&&S?W("button",{type:"button",onClick:()=>S(t),children:o.reopen}):null]}):gt.length>0||t.due_at?xt("div",{className:"wou-nested-meta",children:[W(Ro,{dueAt:t.due_at,now:G}),W(Un,{tags:gt}),s&&S?W("button",{type:"button",onClick:()=>S(t),children:o.reopen}):null]}):s&&S?W("div",{className:"wou-meta",children:s&&S?W("button",{type:"button",onClick:()=>S(t),children:o.reopen}):null}):null,p?W("div",{className:"wou-pending-label",role:"status",children:p}):Me?W("div",{className:"wou-pending-label",role:"status",children:o.renameWithAiPending}):null,St,zo,Ne&&X?W("blockquote",{className:"wou-source-excerpt",children:X}):null,be?xt("form",{className:"wou-snooze-form",onSubmit:M=>{M.preventDefault(),bo()},children:[xt("label",{className:"wou-muted",children:[W("span",{className:"wou-snooze-form-label",children:o.snoozeCustomShort}),W("input",{type:"datetime-local",value:_e,min:Le,onChange:M=>{ee(M.target.value),se(null)}})]}),Te?W("p",{className:"wou-snooze-error",role:"alert",children:Te}):null,xt("div",{className:"wou-snooze-actions",children:[W("button",{type:"submit",children:o.snoozeSubmit}),W("button",{type:"button",onClick:()=>{q(!1),se(null)},children:o.snoozeCancel})]})]}):null]}),l?ko:null,W(dn,{open:Pe,onOpenChange:Ie,createTag:v,applies:!0,onCreated:M=>_(t,M,"none")})]})}import{jsx as V,jsxs as Ve}from"react/jsx-runtime";var nd="optionClickTipDismissed";function rd({ctx:e,group:t,tasks:n,allTags:a,nameAfterChat:s=!1,expanded:l,onToggleExpanded:c,pendingLabels:p,checkboxDisabled:d,groupPending:m,confirmClose:w,actionTasks:f,onConfirmClose:h,onCancelClose:_,onDoneAll:v,onDismissAll:x,onSnoozeAll:b,onMoveQuadrant:S,onToggleTag:A,onCreateTag:F,onProjectClick:te,onRenameGroup:pe,onChildDone:re,onChildDismiss:R,onChildSnooze:Y,onChildToggleTag:Z,onChildRename:G,highlightTokens:j=[],followHighlighted:z=!1,forceExpanded:le=!1,showProjectChips:Ee=!1,showPriorities:He=!0,showAgentChip:Ne=!0,updatedNow:he=new Date,onReload:X}){let be=le||l,[q,E]=Rt(!1),[J,Pe]=Rt(!1),[Ie,$e]=Rt(null),[De,_e]=Rt(!1),[ee,Te]=Rt(!1),se=ka(e,{chat_key:t.chat_key}),[N,B]=Rt(!1),[ge,ye]=Rt(()=>!e.storage.get(nd,!1)),[I,ie]=Rt(!1),[Me,y]=Rt(""),[H,me]=Rt(()=>en(new Date)),[Le,ke]=Rt(null),et=Oo(null),ct=Oo(null),ho=Oo(null),Ut=Oo(null),Et=Oo(null),bo=Oo(null),Ye=!!m,dt=Ec({pending:Ye,confirmClose:!!w,renameOpen:ee,aiQuick:N,customSnoozeOpen:De,checkboxDisabled:d}),oo=Oo(!1),no=P=>{Pe(!1),P&&(oo.current=!0)};dm(()=>{J||oo.current&&(oo.current=!1,Et.current?.focus({preventScroll:!0}))},[J]);let pt=Jo(t,s),Qe=f??n,vt=Ee?Ja(Qe):[],It=Ji(Qe),Kt=_l(Qe);er(()=>{if(!ee)return;let P=bo.current;P&&(P.focus(),P.select())},[ee]);let ro=(P,fe)=>{dt&&(E(!1),$e({x:P,y:fe}),Pe(!0))};er(()=>{dt||(E(!1),Pe(!1))},[dt]),er(()=>{if(!q&&!J)return;let P=fe=>{let st=fe.target;ct.current?.contains(st)||et.current?.contains(st)||Ut.current?.contains(st)||ho.current?.contains(st)||(E(!1),J&&no(!0))};return document.addEventListener("pointerdown",P),()=>document.removeEventListener("pointerdown",P)},[q,J]),er(()=>{if(!q&&!J&&!De&&!ee)return;let P=fe=>{fe.key==="Escape"&&(E(!1),J?no(!0):Pe(!1),_e(!1),ee&&(se.cancel(),Te(!1),y(pt)),ke(null))};return document.addEventListener("keydown",P),()=>document.removeEventListener("keydown",P)},[q,J,De,ee,pt]);let gt=async()=>{await eo(e,t.chat_key,t.chat_title,t.chat_target,Qe)},mt=Xt(new Date),xn=Dn(Math.floor(Date.now()/1e3)),Dt=()=>{E(!1),me(en(new Date)),ke(null),_e(!0)},Tt=()=>{E(!1),se.cancel(),B(!1),y(pt),Te(!0)},St=()=>{se.cancel(),Te(!1),y(pt)},at=async()=>{if(se.busy)return;let P=await se.generate();P&&(y(P),requestAnimationFrame(()=>{let fe=bo.current;fe&&(fe.focus(),fe.select())}))},zo=async()=>{if(E(!1),!se.busy){B(!0);try{let P=await se.generate();if(!P)return;if(((t.title_locked?t.title?.trim():"")||"")===P){ae(o.renameWithAiSame);return}pe(t,P)}finally{B(!1)}}};er(()=>{!N&&se.error&&!ee&&(ue(o.renameWithAiFailed,se.error),se.setError(null))},[N,se.error,ee]);let yo=()=>{let P=vl(Me,pt,t);if(P.action==="close"){Te(!1);return}Te(!1),pe(t,P.value??null)},ko=()=>{let P=jr(H),fe=Math.floor(Date.now()/1e3);if(P==null||P<=fe){ke(o.snoozePast);return}_e(!1),ke(null),b(P)},M=Ue(t.chat_key,t.chat_target).kind==="not-a-chat",Fe=M?V(ma,{agent:t.agent,onClick:()=>{gt()}}):V(ga,{onClick:()=>{gt()}}),Wt=Ui(Qe),vn=zr(Wt,he),tt=Br(Wt),ur=ee?V("input",{ref:bo,type:"text",className:"wou-inline-rename-input wou-group-title",value:Me,maxLength:120,placeholder:pt,disabled:se.busy,onChange:P=>y(P.target.value),onKeyDown:P=>{P.key==="Enter"&&(P.preventDefault(),se.busy||yo()),P.key==="Escape"&&(P.preventDefault(),St())}}):Ve("span",{className:"wou-group-title",children:[V(gn,{text:pt,tokens:j}),be?null:V("span",{className:"wou-group-count-pill",children:o.groupAsksCount(Qe.length)})]}),je=dt?Ve("div",{style:{position:"relative"},ref:ct,children:[V("button",{type:"button",className:"wou-icon","aria-label":o.menuMore,"aria-expanded":q,"aria-haspopup":"menu",disabled:ee||N,onClick:()=>{Pe(!1),E(P=>!P)},children:"\u2026"}),V(ha,{open:q,onClose:()=>E(!1),menuRef:et,anchorRef:ct,onCloseAll:()=>h(),onCloseAllNow:()=>v(),quadrant:t.quadrant,tags:a,tagState:P=>Hr(Qe,P),showWhyHere:!1,hidePriority:!He,onRename:Tt,onRenameWithAi:()=>{zo()},onSnoozeTomorrow:()=>b(mt.tomorrow),onSnoozeMonday:()=>b(mt.nextMonday),onSnoozeWeek:()=>b(mt.inWeek),onCustomSnooze:Dt,onToggleTag:A,onNewTag:()=>ie(!0),onQuadrant:S,onWhyHere:()=>{},onDismiss:()=>x(),dismissLabel:o.notATaskAll})]}):null;return Ve("div",{className:`wou-group${Ye?" wou-row-pending":""}${z?" wou-group-follow-selected":""}`,"data-wou-follow-key":t.chat_key,children:[Ve("div",{ref:Et,className:`wou-row wou-group-parent${ee?" wou-row-rename-open":""}${J||q?" wou-row-menu-open":""}`,"data-rename-open":ee?"true":void 0,tabIndex:dt?0:void 0,"aria-haspopup":dt?"menu":void 0,onContextMenu:P=>{let fe=P.target instanceof HTMLElement?P.target:null;Rc(fe)&&(P.preventDefault(),ro(P.clientX,P.clientY))},onKeyDown:P=>{if(!Ic(P.key,P.shiftKey,P.target,P.currentTarget))return;P.preventDefault(),P.stopPropagation();let fe=Et.current;if(!fe)return;let st=fe.getBoundingClientRect();ro(st.left+st.width/2,st.top+st.height/2)},children:[V("button",{type:"button",className:"wou-group-chevron-btn","aria-expanded":be,"aria-label":l?o.groupCollapse:o.groupExpand,title:o.groupChevronTip,onClick:P=>c(P.altKey),children:V("span",{className:`wou-chevron${l?"":" wou-chevron-collapsed"}`,"aria-hidden":"true",children:"\u25BC"})}),Ye?V("span",{className:"wou-group-checkbox-spacer","aria-hidden":"true"}):V("input",{type:"checkbox","aria-label":o.markGroupDone(pt),title:o.groupCheckboxTip,disabled:d||!!w||ee,onClick:P=>{P.preventDefault(),P.altKey?v():h()},onChange:()=>{}}),Ve("div",{className:"wou-row-body",children:[Ve("div",{className:"wou-card-title-line wou-group-title-line",children:[V("div",{className:"wou-card-title-main",children:ur}),!ee&&vn?V("span",{className:"wou-updated-at wou-muted",title:tt,children:vn}):null,!ee&&!M&&n[0]?V(xa,{task:n[0]}):null,ee?null:V("span",{className:"wou-session-slot",children:Fe}),je]}),ee?Ve("div",{className:"wou-inline-rename-actions",children:[V("button",{type:"button",className:"wou-inline-rename-save",disabled:se.busy,onClick:()=>yo(),children:o.renameSave}),Ve("button",{type:"button",className:"wou-inline-rename-ai",disabled:se.busy,"aria-busy":se.busy,title:o.renameWithAiTip,onClick:()=>{at()},children:[V(uo,{}),V("span",{children:se.busy?o.renameWithAiBusy:o.renameWithAi})]}),V("button",{type:"button",onClick:()=>St(),children:o.renameCancel}),V("span",{className:"wou-inline-rename-hint",children:o.renameKeyboardHint})]}):null,ee&&se.error?V("p",{className:"wou-inline-rename-error",role:"alert",children:se.error}):null,N?V("div",{className:"wou-pending-label",role:"status",children:o.renameWithAiPending}):null,!be&&!w&&!m&&!De&&!ee?V("p",{className:"wou-group-collapsed-preview",children:n[0]?.ask??""}):null,w?Ve("div",{className:"wou-group-confirm",role:"alertdialog","aria-label":o.markAllDone(Qe.length),onKeyDown:P=>{P.key==="Escape"&&_()},children:[V("p",{className:"wou-group-confirm-q",children:o.markAllDone(Qe.length)}),Ve("div",{className:"wou-group-confirm-actions",children:[V("button",{type:"button",className:"wou-group-confirm-yes",autoFocus:!0,onClick:()=>v(),children:o.markAllDoneYes(Qe.length)}),V("button",{type:"button",onClick:()=>_(),children:o.renameCancel})]}),ge?Ve("div",{className:"wou-group-confirm-hint",children:[V("span",{children:o.groupOptionClickHint}),V("button",{type:"button",className:"wou-tip-dismiss","aria-label":o.dismissTip,title:o.dismissTip,onClick:()=>{e.storage.set(nd,!0),ye(!1)},children:"\xD7"})]}):null]}):null,m?V("div",{className:"wou-pending-label",role:"status",children:m}):null,De?Ve("form",{className:"wou-snooze-form",onSubmit:P=>{P.preventDefault(),ko()},children:[Ve("label",{className:"wou-muted",children:[V("span",{className:"wou-snooze-form-label",children:o.snoozeCustomShort}),V("input",{type:"datetime-local",value:H,min:xn,onChange:P=>{me(P.target.value),ke(null)}})]}),Le?V("p",{className:"wou-snooze-error",role:"alert",children:Le}):null,Ve("div",{className:"wou-snooze-actions",children:[V("button",{type:"submit",children:o.snoozeSubmit}),V("button",{type:"button",onClick:()=>{_e(!1),ke(null)},children:o.snoozeCancel})]})]}):null,Ne||Kt!=null&&!be||vt.length>0||It.length>0?Ve("div",{className:"wou-meta",children:[Ne?V("span",{className:"wou-agent-chip",children:t.agent}):null,be?null:V(Ro,{dueAt:Kt,now:he}),vt.slice(0,2).map(P=>V(ta,{project:P,onClick:te},P.key)),vt.length>2?Ve("span",{className:"wou-badge wou-project-chip",children:["+",vt.length-2]}):null,V(Un,{tags:It})]}):null]}),V("span",{ref:Ut,style:{position:"fixed",left:Ie?.x??0,top:Ie?.y??0,width:0,height:0,pointerEvents:"none"},"aria-hidden":"true"}),V(Oc,{open:J&&dt,onClose:P=>no(P==="escape"),menuRef:ho,anchorRef:Ut,onConfirmClose:()=>h(),onDoneAll:()=>v()})]}),be?V("div",{className:"wou-group-children",children:n.map(P=>V(wn,{ctx:e,task:P,allTags:a,nameAfterChat:s,nested:!0,groupTitle:pt,highlightTokens:j,pendingLabel:p[P.id],checkboxDisabled:d||!!p[P.id],onDone:re,onDismiss:R,onSnooze:Y,onMoveQuadrant:()=>{},onToggleTag:Z,onCreateTag:F,onRename:G,onReload:X,showProjectChips:!1,showPriorities:He,updatedNow:he},P.id))}):null,V(dn,{open:I,onOpenChange:ie,createTag:F,applies:!0,onCreated:P=>A(P,"none")})]})}import{jsx as tr,jsxs as ad}from"react/jsx-runtime";function sd({ctx:e,task:t,children:n,pendingLabel:a,disabled:s,onDone:l,onSnooze:c}){let p=ya(),d=!!(s||a),w=Ue(t.chat_key,t.chat_target).kind==="not-a-chat"?o.handleWithAgent(t.agent):o.openSession;return ad("section",{className:"wou-next-up","aria-label":o.nextUpRegion,children:[tr("div",{className:"wou-next-up-kicker",children:tr("span",{children:o.nextUpKicker})}),n,a||p?null:ad("div",{className:"wou-next-up-actions",children:[tr("button",{type:"button",className:"wou-next-up-primary",disabled:d,onClick:()=>l(t),children:o.nextUpDone}),tr("button",{type:"button",disabled:d,onClick:()=>{eo(e,t.chat_key,t.chat_title,t.chat_target,[t])},children:w}),tr("button",{type:"button",title:o.nextUpLaterTip,disabled:d,onClick:()=>c(t,Xt(new Date).tomorrow),children:o.nextUpLater})]})]})}function id(e){let t=new Map,n=e.claims??new Set,a=!1,s=!1,l=()=>{if(a||s)return;let p=[...t.values()].find(h=>h.phase==="waiting"&&h.due);if(!p)return;a=!0,p.phase="sending",e.onChange();let{item:d,signal:m}=p,w=h=>{if(t.delete(d.taskId),n.delete(d.taskId),a=!1,s){h==="sent"&&e.onSent(d);return}h==="sent"?e.onSent(d):e.onFailed(d,h),e.onChange(),l()},f=!1;try{f=e.isStillOpen(d.taskId)}catch{f=!1}if(!f){w("gone");return}e.deliver(d,m).then(h=>w(h?"sent":"not-delivered"),()=>w("error"))},c=p=>{e.clearTimer(p.timer),t.delete(p.item.taskId),n.delete(p.item.taskId),e.onChange()};return{enqueue(p){if(s||t.has(p.taskId)||n.has(p.taskId))return!1;n.add(p.taskId);let d={item:p,phase:"waiting",due:!1,timer:null,signal:{aborted:!1}};return d.timer=e.setTimer(()=>{d.due=!0,l()},e.delayMs),t.set(p.taskId,d),e.onChange(),!0},cancel(p){let d=t.get(p);return!d||d.phase!=="waiting"?!1:(c(d),!0)},cancelLatest(){let p=[...t.values()].filter(m=>m.phase==="waiting"),d=p[p.length-1];return d?(c(d),d.item):null},cancelOutOfScope(p){let d=0;for(let m of[...t.values()])Xn(m.item.scope,p)||(m.phase==="waiting"?(c(m),e.onFailed(m.item,"not-delivered"),d++):m.phase==="sending"&&!m.signal.aborted&&(m.signal.aborted=!0,d++));return d&&l(),d},phase:p=>t.get(p)?.phase??null,get:p=>t.get(p)?.item??null,size:()=>t.size,dispose(){s=!0;for(let[p,d]of[...t])d.phase==="waiting"?(e.clearTimer(d.timer),t.delete(p),n.delete(p)):d.signal.aborted=!0}}}function ld(e,t,n){if(e.scope!==t.scope||e.seq!==t.seq)return null;let a="project_id"in n?n.project_id:void 0;return typeof a=="string"&&a!==t.scope?null:n}function ud(e,t){if(e.scope!=="group"||!Array.isArray(t))return e;let n=new Set(t);return n.size===0?null:e.patches.every(a=>n.has(a.task.id))?e:{...e,tasks:e.tasks.filter(a=>n.has(a.id)),patches:e.patches.filter(a=>n.has(a.task.id))}}var cd=1e4,Sa=1500,dd=600,pd=20,gd=null,md=null,fd=null;function Us(e){gd=e}function wd(){gd?.()}function Ks(e){md=e}function hd(){md?.()}function Ws(e){fd=e}function bd(){fd?.()}var yd=null;function Qs(e){yd=e}function kd(){yd?.()}var Gs=null,Ta=!1;function qs(e){Gs=e,e&&Ta&&(Ta=!1,e())}function xd(){Gs?(Ta=!1,Gs()):Ta=!0}import{host as or,useValue as Cd}from"@hermes/plugin-sdk";import{useCallback as mm,useEffect as Nd,useRef as Pd,useState as fo,useSyncExternalStore as fm}from"react";import{useEffect as pm,useRef as gm}from"react";var vd=[2e3,5e3,1e4,3e4];function Td(e){let t=Math.min(Math.max(e,0),vd.length-1);return vd[t]}function Sd(e,t,n){return e?!0:t!==!0?!1:n}function hn(e,t){let n=gm(e);n.current=e,pm(()=>{if(t)return;let a=!1,s=0,l,c=async()=>{if(a)return;let p=await n.current();if(a||p)return;let d=Td(s);s+=1,l=setTimeout(()=>{c()},d)};return c(),()=>{a=!0,l!==void 0&&clearTimeout(l)}},[t,e])}var $d=_o,wm=3e4;function Ad(e,t=!0){let n=Cd(or.state.profile),a=or.state.focusedSessionProfile?Cd(or.state.focusedSessionProfile):n,s=fm(Zt,Ke,Ke),[l,c]=fo([]),[p,d]=fo([]),[m,w]=fo({}),[f,h]=fo(null),[_,v]=fo(!1),[x,b]=fo(!0),S=Pd(0),A=Pd(0),[F,te]=fo(!1),[pe,re]=fo(!1),R=mm(async Y=>{if(!Ke())return!1;let Z=++S.current;try{let G=await Wr(e,_);return Z!==S.current||(c(G.tasks),d(G.groups??[]),w(G.counts),h(G.last_scan),A.current=0,te(!1),re(!0)),!0}catch(G){return Z!==S.current?!1:co(G)?(zn(!1),!1):(A.current+=1,Y?.userAction?ue(o.loadError):A.current>=3&&te(!0),!1)}finally{Z===S.current&&b(!1)}},[e,_]);return Nd(()=>{if(!s){c([]),d([]),w({}),te(!1),re(!0),b(!1);return}re(!1),b(!0),R()},[R,n,a,s]),hn(R,pe),Nd(()=>{let Y=[],Z=()=>{R()};e.onEvent?Y.push(e.onEvent($d,Z)):or.onEvent&&Y.push(or.onEvent($d,Z)),e.addEventListener&&typeof window<"u"&&Y.push(e.addEventListener(window,Ln,Z));let j=setInterval(()=>{t&&s&&R()},wm);return Y.push(()=>clearInterval(j)),()=>{for(let z of Y)z()}},[e,R,t,s]),{tasks:l,setTasks:c,groups:p,setGroups:d,counts:m,lastScan:f,loading:x,fetchSucceeded:pe,offline:F,includeClosed:_,setIncludeClosed:v,reload:R}}import{host as nr,useValue as rr}from"@hermes/plugin-sdk";import{useCallback as _d,useEffect as Ca,useLayoutEffect as Rd,useMemo as hm,useRef as ar,useState as bm}from"react";var Ed=15;function Id({ctx:e,enabled:t,desktopPane:n,paneVisible:a,tasks:s,groups:l,agentFilter:c,projectFilter:p,tagFilter:d,searchActive:m,collapsed:w,expandedSections:f,groupExpanded:h,sections:_,flatDisplayEntries:v,scrollRef:x,onClearFilters:b,onCloseSearch:S,setCollapsed:A,setExpandedSections:F,setGroupExpanded:te,persistGroupExpanded:pe,persistCollapsed:re,followExtraTasks:R,setFollowExtraTasks:Y,takeQuietChat:Z}){let G=nr.state.focusedStoredSessionId,j=nr.state.activeSessionId,z=nr.state.focusedSessionProfile,le=nr.state.focusedSessionOwner,Ee=nr.state.connectionId,He=G?rr(G):null,Ne=j?rr(j):null,he=z?rr(z):null,X=le?rr(le):null,be=Ee?rr(Ee):null,q={sessionId:He??Ne,profile:he,owner:X},E=hc(q),J=t&&n&&a&&E!=null,Pe=ar(null);Rd(()=>{Pe.current!==E&&(Pe.current=null)},[E]);let Ie=_d((ye,I)=>Pe.current===I?!0:Z?.(ye)?(Pe.current=I,!0):!1,[Z]),[$e,De]=bm(null),_e=ar(null),ee=ar(null),Te=ar(null),se=ar(a);Ca(()=>{a&&!se.current&&(ee.current=null,Te.current=null),se.current=a},[a]);let N=hm(()=>{let ye=new Map;for(let I of s)ye.set(I.id,I);for(let I of R)ye.set(I.id,I);return[...ye.values()]},[s,R]),B=J?Is(N,l,q):null;Ca(()=>{if(!J||!E){Y([]);return}if(Is(s,l,q)){Y([]);return}let I=q.sessionId;if(!I)return;let ie=!1;return Xr(e,I,q.owner?.profile??q.profile??"default",q.owner,be).then(Me=>{if(ie)return;if(Me.kind!=="ok"||!Me.data.tracked){Y([]);return}let y=Me.data.tasks.filter(H=>H.status!=="done"&&H.status!=="dismissed");Y(y)}),()=>{ie=!0}},[J,E,e,s,l,q.sessionId,q.profile,q.owner,be,Y]),Ca(()=>{if(!J){De(null),_e.current=null,ee.current=null,Te.current=null;return}E!==_e.current&&(_e.current=E,ee.current=null,Te.current=null),De(B?.chatKey??null)},[J,E,B?.chatKey]);let ge=_d(ye=>{if(!E||Te.current===E)return;let I=yc(ye,_,{agentFilter:c,projectFilter:p,tagFilter:d,searchActive:m,collapsed:w,expandedSections:f,groupExpanded:h},Ed);(I.agentFilter!==void 0||I.projectFilter!==void 0||I.tagFilter!==void 0)&&b(),I.closeSearch&&S(),I.collapsed&&(A(I.collapsed),re(I.collapsed)),I.expandedSections&&F(I.expandedSections),I.groupExpanded&&(te(I.groupExpanded),pe(I.groupExpanded)),Te.current=E},[E,_,v,c,p,d,m,w,f,h,b,S,A,F,te,pe,re]);return Ca(()=>{!J||!B||!E||Ie(B.chatKey,E)||Te.current!==E&&ge(B)},[J,B,E,ge,Ie]),Rd(()=>{if(!J||!B||!E||!$e||ee.current===E||Ie(B.chatKey,E)||!kc(B,_,v,Ed,f,w))return;let I=x.current;if(!I)return;let ie=I.querySelector(`[data-wou-follow-key="${CSS.escape($e)}"]`);if(!ie)return;let Me=I,y=ie.getBoundingClientRect(),H=Me.getBoundingClientRect(),me=y.top-H.top-H.height/2+y.height/2;Me.scrollTop+=me,ee.current=E},[J,B,E,$e,_,v,f,w,x,c,p,d,m,h,Ie]),J?$e:null}import{useLayoutEffect as Dd,useMemo as ym,useState as Md}from"react";function Ld(e,t,n){let[a,s]=Md(null),[l,c]=Md(()=>typeof document>"u"||document.visibilityState==="visible");return Dd(()=>{if(!n||typeof document>"u")return;let p=()=>c(document.visibilityState==="visible");return document.addEventListener("visibilitychange",p),()=>document.removeEventListener("visibilitychange",p)},[n]),Dd(()=>{if(!n)return;let p=t.current;if(!p)return;if(typeof IntersectionObserver>"u"){s(null);return}let d=new IntersectionObserver(m=>s(m.some(w=>w.isIntersecting)),{threshold:0});return d.observe(p),()=>d.disconnect()},[n,t,e]),ym(()=>n?Sd(e,a,l):!0,[n,e,a,l])}import{Fragment as Kd,jsx as $,jsxs as ne}from"react/jsx-runtime";var xm=15,Fd=Su,vm=3e4;function Fo(e,t){if(co(e)){an()&&ae(o.notOnThisProfile);return}if(rn(e)){ae(o.alreadyCleared),t&&t();return}ue(Ae(e).error||o.patchError)}var jd="sortOrder",Ys="sectionCollapsed",Xs="agentFilter",bn="projectFilter",Na="tagFilter",zd="filtersOpen",Pa="groupExpanded",Bd="answerBarsAll",Wd=8e3,Tm=200,Sm=Wd+2e3,Cm=new Set;function Hd(e){if(!e)return[];let t=[];for(let n of e.querySelectorAll("[data-wou-task-id]")){if(n.offsetParent===null&&n.getClientRects().length===0)continue;let a=Number(n.dataset.wouTaskId);Number.isFinite(a)&&!t.includes(a)&&t.push(a)}return t}function Nm(e,t){return e?.querySelector(`[data-wou-task-id="${t}"]`)??null}function Pm(e,t=40){let n=e.trim().replace(/\s+/g," ");return n.length>t?`${n.slice(0,t-1).trimEnd()}\u2026`:n}var $m={1:o.section1,2:o.section2,3:o.section3,4:o.section4};function Gd(e,t){return wt(e).some(n=>n.id===t.id)?e:{...e,tags:[...wt(e),{id:t.id,name:t.name,color:t.color,source:"manual"}]}}function Ud(e,t){return wt(e).some(n=>n.id===t)?{...e,tags:wt(e).filter(n=>n.id!==t)}:e}function Zs({ctx:e,variant:t,hostPaneVisible:n=!0,onHidePane:a}){let s=Vs(We.state.profile),l=We.state.focusedSessionProfile?Vs(We.state.focusedSessionProfile):s,c=Vs(We.state.connectionId),p=t==="pane",d=Re(null),m=Ld(n,d,p),{tasks:w,setTasks:f,groups:h,lastScan:_,includeClosed:v,setIncludeClosed:x,reload:b,offline:S,fetchSucceeded:A}=Ad(e,m),F=km(Zt,Ke,Ke),[te,pe]=K(!1),[re,R]=K([]),[Y,Z]=K(!1),[G,j]=K({}),[z,le]=K({}),[Ee,He]=K(null),[Ne,he]=K(()=>e.storage.get(Pa,{})),[X,be]=K(!1),[q,E]=K(()=>new Date),[J,Pe]=K(()=>e.storage.get(zd,!1)===!0),Ie=()=>{Pe(i=>(e.storage.set(zd,!i),!i))},[$e,De]=K(()=>e.storage.get(jd,"newest")),[_e,ee]=K(()=>e.storage.get(Ys,{})),[Te,se]=K({}),[N,B]=K(null),[ge,ye]=K(!1),[I,ie]=K(!1),[Me,y]=K(null),[H,me]=K(!1),[Le,ke]=K(!1),[et,ct]=K(()=>Mu(e.storage)),[ho,Ut]=K("checking"),[Et,bo]=K(!1),Ye=N?.settings.consented===!0;Ce(()=>{if(!Ye||te||Le){Ut("checking");return}if(!_&&!Et&&!H||et&&!H)return;let i=!0;return On(e,1).then(u=>{i&&Ut(u.length>0?"ready":"empty")}).catch(()=>{i&&Ut("error")}),()=>{i=!1}},[e,Ye,te,Le,_,Et,w,H,et]);let dt=i=>{ra(e.storage,i)&&ct(!0)},oo=i=>{i&&ra(e.storage,"session",1)&&ct(!0),b()},no=i=>{ra(e.storage,"session",i)&&ct(!0),ke(!1),me(!1),b()},[pt,Qe]=K(!1),[vt,It]=K(null),[Kt,ro]=K(!1),[gt,mt]=K(!1),[xn,Dt]=K(null),[Tt,St]=K(null),[at,zo]=K([]),[yo,ko]=K(0),[M,Fe]=K([]),[Wt,vn]=K(!1),[tt,ur]=K(()=>e.storage.get(Xs,"all")),[je,P]=K(()=>Qi(e.storage.get(bn,"all"))),[fe,st]=K(()=>Vi(e.storage.get(Na,[]))),[xo,ni]=K(!1),[cr,Aa]=K(""),[_a,ri]=K(""),[Ra,Ea]=K(""),[Bo,rp]=K(!1),[ai,Ia]=K([]),dr=Re(!1),si=Re(null),Ho=Re(null),Go=Re(new Map),Uo=Re(new Map),ii=Re(new Map),[pr,ap]=K(()=>e.storage.get(Bd,!1)===!0),li=Re(pr);li.current=pr;let[gr,Tn]=K(null),[ui,sp]=K(null),[ip,ci]=K(0),Mt=Re(null),mr=Re(new Map),fr=Re(null),lp=U(i=>{let u=mr.current.get(i);return u==null||(mr.current.delete(i),u<Date.now())?!1:(fr.current=i,!0)},[]),ot=U(async()=>{Qe(!0);try{let i=await Po(e);return B(i),It(null),!0}catch{return It(o.settingsLoadError),!1}finally{Qe(!1)}},[e]),Qt=Re({scope:0,seq:0}),di=Re({ctx:e,profile:s,focusedProfile:l,connectionId:c}),Ct=U(async()=>{let i=String(Qt.current.scope),u=++Qt.current.seq,g={scope:i,seq:u};mt(!1),Dt(null);try{let k=await ql(e),T=ld(g,{scope:String(Qt.current.scope),seq:Qt.current.seq},k);return T?(zo(T.projects),ko(T.no_project_count),ro(!0),mt(!0),Dt(null),!0):!1}catch{return g.scope!==String(Qt.current.scope)||g.seq!==Qt.current.seq||(mt(!1),Dt(o.projectsLoadError)),!1}},[e,s,l,c]),qe=U(async()=>{try{return Fe(await Vl(e)),vn(!0),!0}catch{return!1}},[e]);Ce(()=>{B(null),It(null),vn(!1)},[e]),Od(()=>{let i=di.current;return(i.ctx!==e||i.profile!==s||i.focusedProfile!==l||i.connectionId!==c)&&(P("all"),e.storage.set(bn,"all")),di.current={ctx:e,profile:s,focusedProfile:l,connectionId:c},Qt.current={scope:Qt.current.scope+1,seq:0},zo([]),ko(0),y(null),ro(!1),mt(!1),Dt(null),()=>{Qt.current.scope+=1}},[e,s,l,c]),hn(ot,N!==null),hn(Ct,Kt),Ce(()=>{let i=()=>{Ct()},u=[];return e.onEvent?u.push(e.onEvent(_o,i)):We.onEvent&&u.push(We.onEvent(_o,i)),e.addEventListener&&typeof window<"u"&&u.push(e.addEventListener(window,Ln,i)),()=>{for(let g of u)g()}},[e,Ct]),hn(qe,Wt),Ce(()=>{Kt&&P(i=>{let u=qi(i,at.map(g=>g.key));return u!==i&&e.storage.set(bn,u),u})},[e,at,Kt]),Ce(()=>{Wt&&st(i=>{let u=Yi(i,M.map(g=>g.id));return u!==i&&e.storage.set(Na,u),u})},[e,M,Wt]);let Da=U(()=>{ie(!1),ke(!1),ye(!0),ot()},[ot]),up=U(()=>{ie(!1),ke(!1),ye(i=>!i),ot()},[ot]),Sn=U(()=>{ie(!1),ye(!1),me(!1),ke(!0)},[]);Ce(()=>(qs(Sn),()=>qs(null)),[Sn]),Ce(()=>{let i=()=>{ot()},u=[];return e.onEvent?u.push(e.onEvent(Fd,i)):We.onEvent&&u.push(We.onEvent(Fd,i)),e.addEventListener&&typeof window<"u"&&u.push(e.addEventListener(window,ls,i)),()=>{for(let g of u)g()}},[e,ot]),Ce(()=>{if(!m)return;let i=setInterval(()=>{ot(),Ct(),qe()},vm);return()=>clearInterval(i)},[m,ot,Ct,qe]),Ce(()=>{let i=setInterval(()=>E(new Date),3e4);return()=>clearInterval(i)},[]),Ce(()=>{if(re.length===0){Z(!1);return}Z(!0);let i=setTimeout(()=>Z(!1),cd);return()=>clearTimeout(i)},[re]);let[wr,cp]=K([]),qt=Oe(()=>w.filter(i=>i.status==="open"||i.status==="snoozed"),[w]),hr=Oe(()=>({consented:Ye,projectsFetchSucceeded:gt,tasksFetchSucceeded:A,offline:S,projects:at,projectKey:Me}),[Ye,gt,A,S,at,Me]),Ko=Oe(()=>I?Wu(qt,hr):[],[I,qt,hr]),Ma=Re(I);Ma.current=I;let pi=Re(Ko);pi.current=Ko;let gi=Re(hr);gi.current=hr;let mi=Re(qt);mi.current=qt;let nt=Oe(()=>{if(wr.length===0)return qt;let i=new Map(qt.map(u=>[u.id,u]));for(let u of wr)i.set(u.id,u);return[...i.values()]},[qt,wr]),fi=Oe(()=>ts(nt,tt,je,fe),[nt,tt,je,fe]),wi=Oe(()=>w.filter(qa),[w]),La=Oe(()=>Hi(fi,h,$e),[fi,h,$e]);Ce(()=>{let i=window.setTimeout(()=>{Ea(cr),ri(cr)},150);return()=>window.clearTimeout(i)},[cr]),Ce(()=>{if(!Bo){dr.current=!1,Ia([]);return}dr.current||(dr.current=!0,Wr(e,!0).then(i=>{Ia(i.tasks.filter(qa))}).catch(()=>{dr.current=!1}))},[Bo,e]),Ce(()=>{if(!xo)return;let i=window.requestAnimationFrame(()=>si.current?.focus());return()=>window.cancelAnimationFrame(i)},[xo]);let ze=p&&xo&&!I,ao=Oe(()=>ze?gl(Ra):[],[ze,Ra]),Oa=ze&&ao.length>0?ao:[],so=N?.settings.name_after_chat??!1,br=tn(N?.settings.group_by,N?.settings.show_priorities),yr=br!=="none",hi=N?.settings.show_project_badges??!0,Fa=Ur(N?.settings.layout),bi=Oe(()=>Tl(nt),[nt]),Wo=Oe(()=>{if(!ze)return La;let i={1:[],2:[],3:[],4:[]};for(let u of[1,2,3,4])i[u]=fl(La[u],ao,void 0,so);return i},[ze,La,ao,so]),Qo=Oe(()=>Ki(Wo,$e),[Wo,$e]),Cn=Oe(()=>br==="priority"?$l(Wo,$m):br==="project"?Pl(Qo,o.sectionNoProject):null,[br,Wo,Qo]),qo=Oe(()=>Fa==="focus"&&!ze?Sl(Cn,Qo):null,[Fa,ze,Cn,Qo]),ja=qo?.task.id??null,kr=Oe(()=>!ze||!Bo?[]:ts(ai,tt,je,fe).filter(u=>Lr(u,ao,{nameAfterChat:so})),[ze,Bo,ai,tt,je,fe,ao,so]),dp=Oe(()=>{let i=0;for(let u of[1,2,3,4])i+=Va(Wo[u]);return i},[Wo]),Nn=U(()=>{ni(!1),Aa(""),ri(""),Ea("")},[]),za=U(()=>{Aa(_a),Ea(_a),ni(!0)},[_a]),Pn=Oe(()=>{if(tt==="all"&&je==="all"&&fe.length===0)return null;let i=[];if(tt!=="all"&&i.push(tt),je!=="all"){let u=je.map(g=>g==="none"?o.projectFilterNone:at.find(k=>k.key===g)?.name??o.projectFilterMany(1));i.push(u.join(", "))}return fe.length>0&&i.push(fe.map(u=>M.find(g=>g.id===u)?.name??"").filter(Boolean).join(" + ")),i.filter(Boolean).join(" \xB7 ")},[tt,je,fe,at,M]),xr=Oe(()=>hi&&Zi(je),[hi,je]),pp=Oe(()=>rl(nt),[nt]),gp=Oe(()=>os(nt),[nt]),yi=U(i=>f(u=>u.filter(g=>g.id!==i)),[f]),ki=U(i=>{let u=new Set(i);f(g=>g.filter(k=>!u.has(k.id)))},[f]),$n=U(i=>{let u=Uo.current.get(i);u&&(clearTimeout(u),Uo.current.delete(i))},[]),vr=U((i,u)=>{$n(i);let g=(ii.current.get(i)??0)+1;ii.current.set(i,g),le(T=>nc(T,i,u,g));let k=setTimeout(()=>{Uo.current.delete(i),le(T=>rc(T,i,g))},Sa);return Uo.current.set(i,k),g},[$n]),Tr=U((i,u,g)=>{le(k=>ac(k,i,u,g))},[]),Sr=U((i,u)=>{$n(i),le(g=>sc(g,i,u))},[$n]);Ce(()=>()=>{for(let i of Uo.current.values())clearTimeout(i);Uo.current.clear()},[]);let ft=U(i=>{let u=Go.current.get(i);u&&(clearTimeout(u),Go.current.delete(i))},[]),Vt=U(i=>{ft(i),j(u=>{if(!(i in u))return u;let g={...u};return delete g[i],g})},[ft]),Vo=U(()=>{be(!0),window.setTimeout(()=>be(!1),dd)},[]),rt=U(i=>{R(u=>[...u.slice(-(pd-1)),i])},[]),Nt=U(()=>{R(i=>i.length===0?i:i.slice(0,-1))},[]),xi=U(i=>{ft(i);let u=setTimeout(()=>{Go.current.delete(i),yi(i),Vt(i)},Sa);Go.current.set(i,u)},[ft,yi,Vt]),Cr=U(i=>{for(let u of i){ft(u);let g=setTimeout(()=>{Go.current.delete(u),ki(i),Vt(u)},Sa);Go.current.set(u,g)}},[ft,ki,Vt]),An=U(async(i,u,g,k,T)=>{if(!G[i.id]){T?.keepVisible||Vo(),k&&j(D=>({...D,[i.id]:k})),rt(g),T?.keepVisible||xi(i.id);try{(await Ft(e,i.id,u)).chat_archived&&u.status==="done"&&j(O=>({...O,[i.id]:o.pendingDoneChatArchived})),b()}catch(D){ft(i.id),Vt(i.id),Nt(),Fo(D,b)}}},[e,G,Vo,rt,xi,ft,Vt,Nt,b]),vo=i=>{An(i,{status:"done"},{scope:"task",task:i,kind:"done",message:o.undoDone,patch:{status:"open"}},o.pendingDone)},Nr=i=>{An(i,{status:"dismissed"},{scope:"task",task:i,kind:"dismissed",message:o.undoDismissed,patch:{status:"open"}},o.pendingDismissed)},To=(i,u)=>{An(i,{snooze_until:u},{scope:"task",task:i,kind:"snooze",message:o.undoSnoozed,patch:{snooze_until:null}},`Snoozed until ${Ya(u)}`)},Ba=(i,u)=>{An(i,{quadrant:u},{scope:"task",task:i,kind:"quadrant",message:o.undoMoved,patch:{quadrant:i.quadrant,quadrant_locked:!!i.quadrant_locked,restore:!0}},`Moved to ${Fr(u)}`)},Pr=(i,u)=>{let g=nt.filter(T=>T.chat_key===i.chat_key).length<2,k=i.title_override??(g?i.chat_name??null:null);An(i,{title:u},{scope:"task",task:i,kind:"rename",message:o.undoRename,patch:{title:k}},"",{keepVisible:!0})},mp=U(async(i,u)=>{let g=nt.filter(T=>T.chat_key===i.chat_key),k=i.title_locked&&i.title?.trim()||null;rt({scope:"group",tasks:g,kind:"rename",message:o.undoRename,patches:[],groupRestore:{chat_key:i.chat_key,patch:{title:k}}});try{await Ot(e,i.chat_key,{title:u}),b()}catch(T){Nt(),Fo(T,b)}},[e,nt,rt,Nt,b]),$r=U((i,u,g)=>{let k=new Set(i);f(T=>T.map(D=>k.has(D.id)?g?Gd(D,u):Ud(D,u.id):D))},[f]),Ar=U(async(i,u,g)=>{let k=g!=="all";$r([i.id],u,k),rt({scope:"tags",kind:"tags",message:o.undoTags,restore:[{taskId:i.id,add:k?[]:[u.id],remove:k?[u.id]:[]}]});try{await bs(e,i.id,k?{add:[u.id]}:{remove:[u.id]}),b(),qe()}catch(T){Nt(),Fo(T,b),b()}},[e,$r,rt,Nt,b,qe]),fp=U(async(i,u,g)=>{if(i.length===0)return;let k=i[0].chat_key,T=g!=="all",D=L=>wt(L).some(we=>we.id===u.id),O=i.filter(L=>T?!D(L):D(L));$r(i.map(L=>L.id),u,T),rt({scope:"tags",kind:"tags",message:o.undoGroupTags,restore:O.map(L=>({taskId:L.id,add:T?[]:[u.id],remove:T?[u.id]:[]}))});try{await Ot(e,k,{task_ids:O.map(L=>L.id),...T?{tags_add:[u.id]}:{tags_remove:[u.id]}}),b(),qe()}catch(L){Nt(),Fo(L,b),b()}},[e,$r,rt,Nt,b,qe]),_n=U(async(i,u)=>{let g=await hs(e,{name:i,color:u});return Fe(k=>k.some(T=>T.id===g.id)?k:[...k,g]),qe(),g},[e,qe]),vi=U(async i=>{let u=await hs(e,i.hint?i:{name:i.name,color:i.color});return Fe(g=>g.some(k=>k.id===u.id)?g:[...g,u]),qe(),u},[e,qe]),wp=U(async(i,u)=>{try{let g=await Yl(e,i,u);return Fe(k=>k.map(T=>T.id===i?{...T,...g}:T)),b(),!0}catch(g){return ue(Ae(g).error||o.tagSaveError),!1}},[e,b]),hp=U(async i=>{if(window.confirm(o.tagDeleteConfirm(i.name)))try{await Xl(e,i.id),Fe(u=>u.filter(g=>g.id!==i.id)),qe(),b()}catch(u){ue(Ae(u).error||o.tagSaveError)}},[e,qe,b]),Ti=U(i=>{let u=[i.key];P(u),e.storage.set(bn,u),Ho.current?.scrollTo({top:0})},[e]),Rn=U(i=>Ne[i]!==!1,[Ne]),bp=U((i,u=!1)=>{let g=!Rn(i),k=u?{...Ne,...Object.fromEntries(h.map(T=>[T.chat_key,g])),[i]:g}:{...Ne,[i]:g};he(k),e.storage.set(Pa,k)},[e,Ne,Rn,h]),Si=U(()=>{let u=!h.some(k=>Rn(k.chat_key)),g={...Ne,...Object.fromEntries(h.map(k=>[k.chat_key,u]))};he(g),e.storage.set(Pa,g)},[e,Ne,h,Rn]),Ci=U(async(i,u,g,k)=>{let T=i[0].chat_key,D=i.map(L=>L.id);if(D.some(L=>G[L]))return;Vo(),j(L=>{let we={...L};for(let Be of D)we[Be]=k;return we});let O=vr(T,k);Cr(D);try{let L=await Ot(e,T,{status:u,task_ids:D}),we=ud(g,L.closed_task_ids);we&&rt(we),L.already_closed&&ae(o.alreadyCleared);let Be=L.chat_archived&&u==="done"?o.pendingDoneChatArchived:void 0;Tr(T,O,Be),b()}catch(L){for(let we of D)ft(we);j(we=>{let Be={...we};for(let Ka of D)delete Be[Ka];return Be}),Sr(T,O),Fo(L,b)}},[G,Vo,rt,Cr,e,b,ft,vr,Tr,Sr]),yp=U(async(i,u)=>{let g=i[0].chat_key,k=i.map(O=>O.id);if(k.some(O=>G[O]))return;Vo();let T=`Snoozed until ${Ya(u)}`;j(O=>{let L={...O};for(let we of k)L[we]=T;return L});let D=vr(g,T);rt({scope:"group",tasks:i,kind:"snooze",message:o.undoGroupSnoozed,patches:i.map(O=>({task:O,patch:{snooze_until:null}}))}),Cr(k);try{await Promise.all(i.map(O=>Ft(e,O.id,{snooze_until:u}))),Tr(g,D),b()}catch(O){for(let L of k)ft(L);j(L=>{let we={...L};for(let Be of k)delete we[Be];return we}),Sr(g,D),Nt(),Fo(O,b)}},[G,Vo,rt,Cr,e,b,ft,Nt,vr,Tr,Sr]),kp=U(async(i,u,g)=>{let k=i[0].chat_key;try{let T=await Ot(e,k,{quadrant:g});T.priority_restore&&rt({scope:"group",tasks:i,kind:"quadrant",message:o.undoGroupMoved,patches:[],groupRestore:{chat_key:k,patch:{priority_restore:T.priority_restore}}}),b()}catch(T){Fo(T,b)}},[e,b,rt,Nt]),Ni=async i=>{try{await Ft(e,i.id,{status:"open"}),Ia(u=>u.filter(g=>g.id!==i.id)),b()}catch{ue(o.patchError)}},En=U(async()=>{if(Mt.current?.cancelLatest()){ae(o.answerCancelled);return}let u=re[re.length-1];if(u){if(R(g=>g.slice(0,-1)),u.scope==="tags"){let g=new Map(M.map(k=>[k.id,k]));f(k=>k.map(T=>{let D=u.restore.find(L=>L.taskId===T.id);if(!D)return T;let O=T;for(let L of D.remove)O=Ud(O,L);for(let L of D.add){let we=g.get(L);we&&(O=Gd(O,we))}return O}));try{await Promise.all(u.restore.map(k=>bs(e,k.taskId,{add:k.add,remove:k.remove}))),b(),qe()}catch{ue(o.patchError),b()}return}if(u.scope==="group"){let g=u.tasks[0]?.chat_key;for(let k of u.tasks)Vt(k.id);g&&($n(g),le(k=>{if(!(g in k))return k;let T={...k};return delete T[g],T})),f(k=>{let T=new Set(k.map(O=>O.id)),D=[...k];for(let O of u.tasks)T.has(O.id)||D.push(O);return D.sort((O,L)=>O.id-L.id)});try{u.groupRestore&&await Ot(e,u.groupRestore.chat_key,u.groupRestore.patch),u.patches.length>0&&await Promise.all(u.patches.map(k=>Ft(e,k.task.id,k.patch))),b()}catch{ue(o.patchError)}return}Vt(u.task.id),f(g=>g.some(k=>k.id===u.task.id)?g:[...g,u.task].sort((k,T)=>k.id-T.id));try{await Ft(e,u.task.id,u.patch),b()}catch{ue(o.patchError)}}},[re,Vt,f,e,b,M,qe]);Ce(()=>(Us(()=>{En()}),()=>Us(null)),[En]),Ce(()=>{let i=d.current;if(!i||!p)return;let u=g=>{if((g.metaKey||g.ctrlKey)&&g.key==="f"){let T=g.target;if(!T||!i.contains(T))return;g.preventDefault(),za();return}if(!(g.metaKey||g.ctrlKey)||g.key!=="z"||g.shiftKey)return;let k=g.target;!k||!i.contains(k)||k.tagName==="INPUT"||k.tagName==="TEXTAREA"||k.isContentEditable||(g.preventDefault(),En())};return i.addEventListener("keydown",u),()=>i.removeEventListener("keydown",u)},[En,p,za]);let Pi=U(i=>{if(i.skipped==="consent"){St(null),ot();return}if(i.skipped==="off"){St("off");return}if(i.capped){St("capped");return}if(i.skipped==="locked"){St("locked"),b(),Ct();return}if(St(null),!i.skipped){let u=tc(i);if(u)ue(u);else{let g=i.added??0,k=i.resolved??0;ae(o.scanDone(g,k,i.expired??0))}}b(),Ct(),ot()},[ot,Ct,b]);Ce(()=>{if(Tt!=="capped"||N==null)return;let i=N.settings.daily_call_cap;(i<=0||N.usage.today.calls<i)&&St(null)},[Tt,N]);let Yo=U(async(i=!1)=>{if(!te){pe(!0);try{let u=await Zl(e,i?{force:!0}:void 0);!u.skipped&&!u.capped&&bo(!0),Pi(u)}catch(u){let g=u;g?.status===429||String(g?.message??"").includes("429")?ae(o.scanRateLimited):ue(o.scanFailed)}finally{pe(!1)}}},[e,te,Pi]),xp=()=>{Yo(!1)};Ce(()=>(Ks(()=>{Yo(!1)}),()=>Ks(null)),[Yo]),Ce(()=>(Ws(Si),()=>Ws(null)),[Si]);let vp=async()=>{try{let i=await $o(e,{consented:!0});B(u=>u?{...u,settings:i.settings}:{settings:i.settings,usage:{today:{calls:0,prompt_tokens:0,completion_tokens:0},history:[]},model:{provider:null,model:null,label:"your main Hermes model"}}),p&&me(!0),await Yo(!1)}catch{ue(o.patchError)}},Tp=i=>{De(i),e.storage.set(jd,i)},Sp=i=>{let u={..._e,[i]:!_e[i]};ee(u),e.storage.set(Ys,u)},$i=t==="page"?"wou-page":"wou-pane",Yt=p&&N!=null&&!N.settings.consented,Ai=N?.settings,Cp=N!=null&&cl(N.usage.today.calls,N.settings.daily_call_cap),_i=Ai?ul(Ai.mode):null,Ri=_?.at,_r=Ri!=null?Wi(Ri,q):"",Ei=_r?`${o.updatedPrefix} ${_r}`:null,Xo=ge||Le||H||I,Rr=tt!=="all"||je!=="all"||fe.length>0,Er=U(()=>{ur("all"),P("all"),st([]),e.storage.set(Xs,"all"),e.storage.set(bn,"all"),e.storage.set(Na,[])},[e]),Np=U(i=>e.storage.set(Ys,i),[e]),Pp=U(i=>e.storage.set(Pa,i),[e]),io=Id({ctx:e,enabled:!I&&(N?.settings.follow_selected_chat??!0),desktopPane:p,paneVisible:m,tasks:qt,groups:h,agentFilter:tt,projectFilter:je,tagFilter:fe,searchActive:ze,collapsed:_e,expandedSections:Te,groupExpanded:Ne,sections:Cn,flatDisplayEntries:Qo,scrollRef:Ho,onClearFilters:Er,onCloseSearch:Nn,setCollapsed:ee,setExpandedSections:se,setGroupExpanded:he,persistGroupExpanded:Pp,persistCollapsed:Np,followExtraTasks:wr,setFollowExtraTasks:cp,takeQuietChat:lp}),Zo=Oe(()=>js(We),[]),Ir=Re(nt);Ir.current=nt;let Ii=Re(vo);Ii.current=vo;let Ha=Re(To);Ha.current=To;let Ga=Re(gr);Ga.current=gr;let Lt=U(()=>{let i=We.state.connectionId?.get()??null,g=We.state.focusedSessionOwner?.get()?.profile??We.state.focusedSessionProfile?.get()??null;return qc(i,g)},[]);Ce(()=>{let i=We.state.connectionId;if(!i)return;let u=We.state.focusedSessionOwner,g=We.state.focusedSessionProfile,k=Lt(),T=()=>{let O=Lt();Xn(k,O)||(k=O,ci(L=>L+1),Mt.current?.cancelOutOfScope(O))},D=[i,u,g].filter(O=>!!O).map(O=>O.subscribe(T));return()=>D.forEach(O=>O())},[Lt]),Ce(()=>{let i=id({delayMs:Gc,setTimer:(u,g)=>window.setTimeout(u,g),clearTimer:u=>window.clearTimeout(u),isStillOpen:u=>Ir.current.some(g=>g.id===u&&g.status==="open"),claims:Cm,deliver:async(u,g)=>{let k=d.current,T=document.activeElement,D=!!(k&&T&&k.contains(T)),O=!1,L=()=>{O=!0},we=lo=>{lo.key==="Tab"&&(O=!0)};window.addEventListener("pointerdown",L,!0),window.addEventListener("keydown",we,!0);let Be=()=>{if(!D||!k||O||g.aborted)return;let lo=document.activeElement;if(lo&&k.contains(lo))return;(T&&T.isConnected?T:k).focus({preventScroll:!0})},Ka=We.composer,_p=We.state?.focusedStoredSessionId;try{return await Vc({composer:Ka,shownSessionId:()=>_p?.get()??null,inScope:()=>Xn(u.scope,Lt()),openInPlace:async lo=>{mr.current.set(u.chatKey,Date.now()+Sm),await $c(lo),window.requestAnimationFrame(Be)},sleep:lo=>new Promise(ji=>window.setTimeout(ji,lo)),timeoutMs:Wd,pollMs:Tm,signal:g},u.sessionId,u.text)}finally{mr.current.delete(u.chatKey),window.removeEventListener("pointerdown",L,!0),window.removeEventListener("keydown",we,!0),window.requestAnimationFrame(Be)}},onSent:u=>{ae(o.answerSent(u.label,u.chatTitle));let g=Ir.current.find(k=>k.id===u.taskId);g&&g.status==="open"&&Ii.current(g)},onFailed:(u,g)=>{g==="gone"?ae(o.answerGone(u.chatTitle)):ue(o.answerNotSent(u.chatTitle),`answer ${g} task=${u.taskId}`)},onChange:()=>ci(u=>u+1)});return Mt.current=i,()=>{i.dispose(),Mt.current===i&&(Mt.current=null)}},[Lt]);let Dr=U((i,u)=>{let g=Ho.current,k=Ma.current?pi.current:Hd(g),T=Wc(k,u,i);if(T==null)return;Tn(T);let D=Nm(g,T);D&&(D.scrollIntoView({block:"nearest"}),D.focus({preventScroll:!0}))},[]),Mr=U((i,u,g)=>{let k=Mt.current;if(!k||!Zn(i,Zo,Lt())||Jn(i)||u!=="reply"&&!Yn(i.ask))return;let T=Ue(i.chat_key,i.chat_target);if(T.kind!=="main")return;let D=Uc(u,i.ask,g);if(!D)return;let O=u==="yes"?o.answerYes:u==="no"?o.answerNo:Pm(g??""),L=i.chat_title?.trim()||i.topic?.trim()||o.pluginName;if(!k.enqueue({taskId:i.id,sessionId:T.sessionId,chatKey:i.chat_key,scope:Lt(),text:D,label:O,chatTitle:L})){ae(o.answerAlreadyPending);return}Ga.current===i.id&&Dr(1,i.id)},[Zo,Dr,Lt]),$p=Oe(()=>({activeId:gr,showAll:pr,canSubmit:Zo&&Lt().profile==="default",replyRequest:ui,phase:i=>Mt.current?.phase(i)??null,answerLabel:i=>Mt.current?.get(i)?.label??null,activate:i=>Tn(i.id),answer:Mr,cancel:i=>{Mt.current?.cancel(i.id)&&ae(o.answerCancelled)},later:i=>Ha.current(i,Xt(new Date).tomorrow),open:i=>{eo(e,i.chat_key,i.chat_title,i.chat_target,[i])}}),[gr,pr,Zo,ui,Mr,e,ip]),Di=Re([]);Od(()=>{let i=Ho.current,u=I?Ko:Hd(i),g=Di.current;Di.current=u,Tn(k=>{let T=Qc(g,u,k);if(T!=null)return T;if(u.length===0)return null;if(I)return u[0];if(io){let D=i?.querySelector(`[data-wou-follow-key="${CSS.escape(io)}"]`),O=D?.dataset.wouTaskId?D:D?.querySelector("[data-wou-task-id]"),L=O?Number(O.dataset.wouTaskId):NaN;if(u.includes(L))return L}return u[0]})}),Ce(()=>{I&&Tn(i=>i!=null&&Ko.includes(i)?i:Ko[0]??null)},[I,Me,Ko]),Ce(()=>{if(I)return;if(!io){fr.current=null;return}if(fr.current===io)return;fr.current=null;let u=Ho.current?.querySelector(`[data-wou-follow-key="${CSS.escape(io)}"]`),g=u?.dataset.wouTaskId?u:u?.querySelector("[data-wou-task-id]"),k=g?Number(g.dataset.wouTaskId):NaN;Number.isFinite(k)&&Tn(k)},[io]),Ce(()=>(Qs(()=>{let i=!li.current;ap(i),e.storage.set(Bd,i),ae(i?o.answerBarsAllOn:o.answerBarsAllOff)}),()=>Qs(null)),[e]);let Mi=(!Xo||I)&&!v&&Ye;Ce(()=>{let i=d.current;if(!i||!Mi)return;let u=g=>{if(g.defaultPrevented||g.isComposing)return;let k=g.target;if(!k||!i.contains(k)||k.closest('[role="menu"], [role="dialog"]'))return;let T=k.tagName==="INPUT"||k.tagName==="TEXTAREA"||k.tagName==="SELECT"||k.isContentEditable,D=Kc({key:g.key,metaKey:g.metaKey,ctrlKey:g.ctrlKey,altKey:g.altKey,shiftKey:g.shiftKey,typing:T});if(!D)return;let O=Ga.current;if(D==="next"||D==="prev"){g.preventDefault(),Dr(D==="next"?1:-1,O);return}let L=Ma.current?Qu(mi.current,gi.current,O):Ir.current.find(Be=>Be.id===O);if(!L||Mt.current?.phase(L.id))return;let we=Zn(L,Zo,Lt());if(D==="yes"||D==="no"){if(!we||!Yn(L.ask))return;g.preventDefault(),Mr(L,D)}else if(D==="reply"){if(!we)return;g.preventDefault(),sp(Be=>({taskId:L.id,n:(Be?.n??0)+1}))}else if(D==="later"){if(L.status!=="open")return;g.preventDefault(),Ha.current(L,Xt(new Date).tomorrow)}else D==="open"&&(g.preventDefault(),eo(e,L.chat_key,L.chat_title,L.chat_target,[L]))};return i.addEventListener("keydown",u),()=>i.removeEventListener("keydown",u)},[Mi,Zo,Mr,Dr,e]);let Li=re[re.length-1],Oi=re.length>1?re.length-1:0,Ap=ze&&ao.length>0&&dp===0&&kr.length===0,Ua=(i,u=!1,g=!1)=>$(wn,{defaultDetailsOpen:u,inNextUp:u,ctx:e,task:i,allTags:M,nameAfterChat:so,pendingLabel:G[i.id],checkboxDisabled:X||!!G[i.id],onDone:vo,onDismiss:Nr,onSnooze:To,onMoveQuadrant:Ba,onToggleTag:(k,T,D)=>{Ar(k,T,D)},onCreateTag:_n,onProjectClick:Ti,onRename:Pr,onReload:()=>{b()},highlightTokens:Oa,followHighlighted:io===i.chat_key,showProjectChips:xr,showPriorities:yr&&!g,showAgentChip:bi,updatedNow:q},u?`next-up-${i.id}`:i.id),Fi=i=>{if(i.kind==="task")return i.task.id===ja?null:Ua(i.task);let{group:u}=i,g=i.tasks,k=ja==null?i.tasks:i.tasks.filter(T=>T.id!==ja);return k.length===0?null:$(rd,{ctx:e,group:u,tasks:k,allTags:M,nameAfterChat:so,expanded:Rn(u.chat_key),forceExpanded:ze&&ao.length>0,highlightTokens:Oa,followHighlighted:io===u.chat_key,onToggleExpanded:T=>bp(u.chat_key,T),pendingLabels:G,checkboxDisabled:X,groupPending:ic(z,u.chat_key),confirmClose:Ee===u.chat_key,actionTasks:g,onConfirmClose:()=>He(u.chat_key),onCancelClose:()=>He(null),onDoneAll:()=>{He(null),Ci(g,"done",{scope:"group",tasks:g,kind:"done",message:o.undoGroupDone,patches:g.map(T=>({task:T,patch:{status:"open"}}))},o.pendingDone)},onDismissAll:()=>{Ci(g,"dismissed",{scope:"group",tasks:g,kind:"dismissed",message:o.undoGroupDismissed,patches:g.map(T=>({task:T,patch:{status:"open"}}))},o.pendingDismissed)},onSnoozeAll:T=>{yp(g,T)},onMoveQuadrant:T=>{kp(g,u.quadrant,T)},onToggleTag:(T,D)=>{fp(g,T,D)},onCreateTag:_n,onProjectClick:Ti,onRenameGroup:(T,D)=>{mp(T,D)},onChildDone:vo,onChildDismiss:Nr,onChildSnooze:To,onChildToggleTag:(T,D,O)=>{Ar(T,D,O)},onChildRename:Pr,onReload:()=>{b()},showProjectChips:xr,showPriorities:yr,showAgentChip:bi,updatedNow:q},u.chat_key)};return F?$(zs.Provider,{value:$p,children:$(Nc,{children:ne("div",{className:`${r} wou-layout-${Fa}`,ref:d,tabIndex:-1,children:[$("style",{children:Ao}),ne("div",{className:$i,children:[ne("header",{className:"wou-header",children:[ne("div",{className:"wou-header-row1",children:[$("h1",{className:"wou-title",children:o.pluginName}),Ei?$("span",{className:"wou-header-updated wou-muted",children:Ei}):null,S?$("span",{className:"wou-header-status wou-muted",role:"status",children:o.offline}):null,_i?$("span",{className:"wou-header-status wou-muted",children:_i}):null,Cp?$("span",{className:"wou-header-status wou-muted",children:o.headerDailyLimit}):null,ne("div",{className:"wou-header-actions",children:[Ye&&!ge&&!Le&&!H?$("button",{type:"button",className:"wou-link","aria-pressed":I,onClick:()=>{I||(y(je==="all"||je.length!==1||je[0]==="none"?null:je[0]),x(!1),Nn(),Ct()),ie(i=>!i)},children:"Catch up"}):null,p&&!I?$("button",{type:"button",className:"wou-icon-btn",onClick:()=>za(),"aria-label":o.searchOpen,title:o.searchOpen,children:$(su,{})}):null,!v&&!Yt&&!Xo&&!xo?$("button",{type:"button",className:`wou-icon-btn wou-filter-btn${Rr||$e!=="newest"?" wou-filter-btn-on":""}`,onClick:Ie,"aria-expanded":J,"aria-controls":"wou-filter-row","aria-label":Rr?o.filtersButtonActive:o.filtersButton,title:Rr?o.filtersButtonActive:o.filtersButton,children:$(hu,{})}):null,$("button",{type:"button",className:"wou-icon-btn",onClick:()=>{xp()},disabled:te,"aria-busy":te,"aria-label":o.scanNow,title:o.scanNow,children:$(qr,{className:te?"wou-icon-spin":void 0})}),$("button",{type:"button",className:"wou-icon-btn",onClick:()=>up(),"aria-label":o.settings,"aria-pressed":ge,title:o.settings,children:$(wu,{})}),p&&a?$("button",{type:"button",className:"wou-icon-btn",onClick:a,"aria-label":o.hidePaneHeader,title:o.hidePaneHeader,children:$(fu,{})}):null]})]}),Tt==="capped"&&!te?ne("div",{className:"wou-scan-banner",role:"status",children:[$("span",{children:o.scanCapped}),$("button",{type:"button",className:"wou-link",onClick:()=>{Yo(!0)},children:o.scanAnyway})]}):null,Tt==="locked"&&!te?ne("div",{className:"wou-scan-banner",role:"status",children:[$("span",{children:o.scanLocked}),$("button",{type:"button",className:"wou-link",onClick:()=>{Yo(!0)},children:o.scanTryAgain})]}):null,Tt==="off"?ne("div",{className:"wou-scan-banner",role:"status",children:[$("span",{children:o.scanUpdatesOff}),$("button",{type:"button",className:"wou-link",onClick:()=>Da(),children:o.settings})]}):null,S||Yt?null:Zu(_?.errors).map(i=>ne("div",{className:"wou-scan-banner wou-scan-banner-warn",role:"status",children:[$("span",{children:oc(i)}),$("button",{type:"button",className:"wou-link",onClick:()=>Da(),children:o.settings})]},i.name)),S||Yt?null:Ju(_?.errors).map(i=>$("div",{className:"wou-scan-banner wou-scan-banner-warn",role:"status",children:ec(i)},i.name??"default")),te?$("p",{className:"wou-muted wou-scan-banner",role:"status",children:o.scanningHint}):null,!Yt&&!Xo&&xo?ne("div",{className:"wou-search-row",children:[ne("div",{className:"wou-search-row-main",children:[$("input",{ref:si,type:"search",className:"wou-search-input",value:cr,onChange:i=>Aa(i.target.value),placeholder:o.searchPlaceholder,"aria-label":o.searchAria,onKeyDown:i=>{i.key==="Escape"&&(i.preventDefault(),Nn())}}),ne("label",{className:"wou-search-include",children:[$("input",{type:"checkbox",checked:Bo,onChange:i=>rp(i.target.checked)}),o.searchIncludeClosed]}),$("button",{type:"button",className:"wou-icon-btn wou-search-close",onClick:()=>Nn(),"aria-label":o.searchClose,title:o.searchClose,children:"\xD7"})]}),Pn?ne("p",{className:"wou-search-filtered wou-muted",children:[ne("span",{children:[o.searchFilteredPrefix," ",Pn]}),$("button",{type:"button",className:"wou-link",onClick:Er,children:o.clearFilters})]}):null]}):null,!v&&!Yt&&!Xo&&!xo&&!J&&Pn?ne("p",{className:"wou-filter-summary wou-muted",children:[ne("button",{type:"button",className:"wou-link wou-filter-summary-text",onClick:Ie,title:Pn,children:[o.filtersSummary,": ",Pn]}),$("button",{type:"button",className:"wou-link wou-clear-filters",onClick:Er,children:o.clearFilters})]}):null,!v&&!Yt&&!Xo&&!xo&&J?ne("div",{className:"wou-header-row2",id:"wou-filter-row",children:[ne("select",{className:"wou-select",value:tt==="all"?"all":tt,onChange:i=>{let u=i.target.value,g=u==="all"?"all":u;ur(g),e.storage.set(Xs,g)},"aria-label":o.agentFilterLabel,title:o.agentFilterLabel,children:[$("option",{value:"all",children:ol(gp)}),pp.map(({agent:i,counts:u})=>$("option",{value:i,children:nl(i,u)},i))]}),$(cc,{filter:je,projects:at,noProjectCount:yo,onOpen:()=>{Ct()},onChange:i=>{P(i),e.storage.set(bn,i)}}),$(dc,{filter:fe,tags:M,onOpen:()=>{qe()},onChange:i=>{st(i),e.storage.set(Na,i)}}),ne("select",{className:"wou-select",value:$e,onChange:i=>Tp(i.target.value),"aria-label":o.sortLabel,title:o.sortLabel,children:[$("option",{value:"newest",children:o.sortNewest}),$("option",{value:"oldest",children:o.sortOldest})]}),Rr?$("button",{type:"button",className:"wou-link wou-clear-filters",onClick:Er,children:o.clearFilters}):null]}):null]}),ne("div",{className:"wou-scroll",ref:Ho,children:[Lu({desktop:p,consented:Ye,scanned:_!=null||Et,availability:ho,resolved:et,onboarding:H,settings:ge||I,teaching:Le,searching:ze,closed:v})?ne("aside",{className:"wou-teach-prompt","aria-labelledby":"wou-teach-prompt-title",children:[$("button",{type:"button",className:"wou-icon-btn wou-teach-prompt-close","aria-label":o.teachCardDismiss,onClick:()=>dt("dismiss"),children:"\xD7"}),$("h2",{id:"wou-teach-prompt-title",children:o.teachCardTitle}),$("p",{className:"wou-muted",children:o.teachCardIntro}),ne("div",{className:"wou-teach-prompt-actions",children:[$("button",{type:"button",className:"wou-btn-compact",onClick:Sn,children:o.teachCardStart}),$("button",{type:"button",className:"wou-link",onClick:()=>dt("not-now"),children:o.teachCardNotNow})]})]}):null,ge&&N?$(Uu,{ctx:e,bundle:N,tags:M,onCreateTag:_n,onPatchTag:wp,onDeleteTag:i=>{hp(i)},onAddSuggestedTag:vi,onBundleChange:B,onOpenTeach:Sn,onBack:()=>{ye(!1),ot()}}):ge?ne("div",{className:"wou-settings-loading",role:"status",children:[$("p",{className:"wou-muted",children:o.settingsLoading}),vt?ne("p",{children:[vt," ",$("button",{type:"button",className:"wou-link",onClick:()=>{ot()},children:o.retry})]}):null]}):Le?$(Xu,{ctx:e,now:q,scanning:te,onBack:no,onAnswered:oo}):H&&!Yt?$(ju,{ctx:e,tags:M,scanning:te,teachAvailability:ho,onAddTag:vi,onTeachNow:Sn,onFinish:()=>me(!1)}):Yt&&N?$(Fu,{settings:N.settings,model:N.model,scanning:te,onStart:()=>{vp()},onChangeSettings:()=>Da()}):I&&Ye?$(qu,{projects:at,projectKey:Me,onProjectChange:y,tasks:qt,ready:Kt&&gt&&A,offline:S,consented:Ye,projectsFetchSucceeded:gt,tasksFetchSucceeded:A,projectsError:xn,onRetryProjects:()=>{Ct()},renderTask:Ua,onBack:()=>ie(!1)}):v?$("section",{className:"wou-section",children:wi.length===0?$("p",{className:"wou-muted",children:o.sectionEmpty}):wi.map(i=>$(wn,{ctx:e,task:i,allTags:M,nameAfterChat:so,closed:!0,showProjectChips:xr,showPriorities:yr,updatedNow:q,onDone:vo,onDismiss:Nr,onSnooze:To,onMoveQuadrant:Ba,onToggleTag:(u,g,k)=>{Ar(u,g,k)},onCreateTag:_n,onRename:Pr,onReopen:Ni,onReload:()=>{b()}},i.id))}):Ap?ne("div",{className:"wou-search-empty",children:[$("p",{children:o.searchNoMatch(Ra.trim())}),$("button",{type:"button",className:"wou-link",onClick:()=>Nn(),children:o.searchClear})]}):nt.length===0&&!ze?ne("div",{className:"wou-list-empty",children:[$("p",{children:o.listEmpty}),_r?$("p",{className:"wou-muted",children:o.listEmptyScan(_r)}):null]}):ne(Kd,{children:[qo?$(sd,{ctx:e,task:qo.task,pendingLabel:G[qo.task.id],disabled:X,onDone:vo,onSnooze:To,children:Ua(qo.task,!0,qo.group!=null)}):null,Cn==null?$("section",{className:"wou-section wou-flat-list",children:Qo.map(i=>Fi(i))}):Cn.map(({key:i,title:u,entries:g})=>{let k=Va(g);if(ze&&k===0)return null;let T=ze&&k>0?!1:!!_e[i],D=Te[i],O=ze||D?g:g.slice(0,xm),L=g.length-O.length,we=`wou-sec-${i.replace(/[^a-zA-Z0-9_-]/g,"_")}`;return ne("section",{className:"wou-section","aria-labelledby":we,children:[ne("button",{type:"button",id:we,className:"wou-section-heading","aria-expanded":!T,onClick:()=>Sp(i),children:[$("span",{className:`wou-chevron${T?" wou-chevron-collapsed":""}`,"aria-hidden":"true",children:"\u25BC"}),ne("span",{children:[u," (",ns(g),")"]})]}),T?null:k===0?$("p",{className:"wou-muted",children:o.sectionEmpty}):ne(Kd,{children:[O.map(Be=>Fi(Be)),!ze&&!D&&L>0?$("button",{type:"button",className:"wou-link wou-show-all",onClick:()=>se(Be=>({...Be,[i]:!0})),children:tl(g)}):null]})]},i)}),ze&&Bo?ne("section",{className:"wou-section","aria-labelledby":"wou-sec-closed",children:[$("div",{className:"wou-section-heading",id:"wou-sec-closed",children:ne("span",{children:[o.searchClosedSection," (",kr.length,")"]})}),kr.length===0?$("p",{className:"wou-muted",children:o.sectionEmpty}):kr.map(i=>$(wn,{ctx:e,task:i,allTags:M,nameAfterChat:so,closed:!0,highlightTokens:Oa,onDone:vo,onDismiss:Nr,onSnooze:To,onMoveQuadrant:Ba,onToggleTag:(u,g,k)=>{Ar(u,g,k)},onCreateTag:_n,onRename:Pr,onReopen:Ni,onReload:()=>{b()},showProjectChips:xr,showPriorities:yr,updatedNow:q},i.id))]}):null]}),!Yt&&!Xo?ne("footer",{className:"wou-footer",children:[ne("label",{style:{display:"flex",alignItems:"center",gap:8},children:[$("input",{type:"checkbox",checked:v,onChange:i=>x(i.target.checked),"aria-label":v?o.hideClosed:o.showClosed}),v?o.hideClosed:o.showClosed]}),$("p",{className:"wou-muted",style:{margin:"8px 0 0"},children:o.closedNote})]}):null,Y&&Li?ne("div",{className:"wou-undo",role:"status",children:[ne("span",{children:[Li.message,Oi>0?` ${o.undoMore(Oi)}`:""]}),$("button",{type:"button",onClick:()=>{En()},children:o.undo})]}):null]})]})]})})}):t==="pane"?null:ne("div",{className:r,ref:d,children:[$("style",{children:Ao}),$("div",{className:$i,children:$("p",{className:"wou-muted",children:o.notOnThisProfile})})]})}function Qd({registered:e,visible:t,hasActiveSession:n}){return e&&t?"hide":!n&&!(e&&t)?"navigate":e&&!t?"reveal":"show"}var Js=!1,ei=new Set;function sr(){return Js}function yn(e){if(Js!==e){Js=e;for(let t of ei)t()}}function qd(e){return ei.add(e),()=>ei.delete(e)}import{jsx as to}from"react/jsx-runtime";var ve=it,kn=`${ve}:tasks`,$a="paneHidden",Am={display:"inline-flex",alignItems:"center",justifyContent:"center",height:"100%",padding:"0 6px",fontSize:"0.6875rem",color:"var(--ui-text-tertiary)",background:"transparent",border:"none",cursor:"pointer"},Gt=null,jo=null,lr=!1,ir=null;function _m(){return{id:"nav",area:"sidebar.nav",order:40,data:{path:"/waiting-on-you",label:o.pluginName,codicon:"checklist"}}}function Jd(e){jo||(jo=e.register(_m()))}function Yd(e){jo&&(jo(),jo=null),Gt&&(Gt(),Gt=null,yn(!1),lr=!0)}function Rm(e){Jd(e),lr&&(lr=!1,e.storage.get($a,!1)||oi(e))}function wo(){return Ke()?!0:(ae(o.notOnThisProfile),!1)}function oi(e){Gt||(Gt=e.register({id:"tasks",area:"panes",title:o.pluginName,data:{placement:"right",width:"420px",hideOnly:!0},render:()=>to(Mm,{ctx:e,onHidePane:()=>ep(e)})}),yn(!0))}function ep(e,t=!0){Gt&&(Gt(),Gt=null,yn(!1),e.storage.set($a,!0),t&&ae(o.paneHiddenNotify))}function tp(e){oi(e),e.storage.set($a,!1),setTimeout(()=>Je.revealPane(kn),0)}function ti(e){if(!wo())return;let t=sr(),n=Je.paneVisibility(kn).get(),a=Je.state.activeSessionId.get()!=null;switch(Qd({registered:t,visible:n,hasActiveSession:a})){case"hide":ep(e);break;case"show":tp(e);break;case"reveal":Je.revealPane(kn);break;case"navigate":Je.navigate("/waiting-on-you");break}}function Xd(e){if(!wo())return;let t=sr(),n=Je.state.activeSessionId.get()!=null;if(!t){n?tp(e):Je.navigate("/waiting-on-you");return}n?Je.revealPane(kn):Je.navigate("/waiting-on-you")}async function op(e,t){if(wo())try{let n=await Po(e),a=t(Qr(n.settings));await $o(e,{group_by:a}),ae(a==="none"?o.groupedByNone:a==="project"?o.groupedByProject:o.groupedByPriority)}catch{ae(o.patchError)}}async function Em(e,t,n,a){if(wo())try{let l=!(await Po(e)).settings[t];await $o(e,{[t]:l}),ae(l?n:a)}catch{ae(o.patchError)}}function np(e,t){switch(t){case`${ve}.open-keybind`:return()=>ti(e);case`${ve}.undo`:return()=>{wo()&&wd()};case`${ve}.toggle-priorities`:return()=>{op(e,Cl)};case`${ve}.toggle-project-badges`:return()=>{Em(e,"show_project_badges",o.projectBadgesOn,o.projectBadgesOff)};case`${ve}.toggle-groups`:return()=>{wo()&&bd()};case`${ve}.toggle-answer-bars`:return()=>{wo()&&kd()};case`${ve}.scan`:return()=>{wo()&&hd()};default:return}}function Im(e,t){return np(e,t)}function Dm({ctx:e}){return to(Zs,{ctx:e,variant:"page"})}function Mm({ctx:e,onHidePane:t}){let n=Zd(Je.paneVisibility(kn));return to(Zs,{ctx:e,variant:"pane",hostPaneVisible:n,onHidePane:t})}function Lm({onToggle:e}){let t=Vd(Zt,Ke,Ke),n=Vd(qd,sr,sr),a=Zd(Je.paneVisibility(kn)),s=n&&a,l=s?o.statusBarHidePane:o.statusBarShowPane;return t?to("button",{type:"button",onClick:e,title:l,"aria-label":l,"aria-pressed":s,style:Am,onMouseEnter:c=>{c.currentTarget.style.color="var(--foreground)",c.currentTarget.style.background="var(--chrome-action-hover)"},onMouseLeave:c=>{c.currentTarget.style.color="var(--ui-text-tertiary)",c.currentTarget.style.background="transparent"},children:to("span",{style:{display:"inline-flex",width:14,height:14},children:to(Vr,{})})}):null}var Om={id:ve,name:o.pluginName,defaultEnabled:!1,register(e){Gt=null,jo=null,lr=!1,ir?.(),ir=null,e.onDispose(()=>{Gt=null,jo=null,lr=!1,ir?.(),ir=null,yn(!1)}),e.storage.get($a,!1)?yn(!1):oi(e);let n=vs.flatMap(d=>{let m=np(e,d.keybindId);if(!m)return[];let w=[{id:d.registerSlotId,area:"keybinds",data:{id:d.keybindId,label:d.keybindLabel,category:d.category,defaults:d.defaults,run:m}}];if(d.paletteLabel){let f=d.registerSlotId.replace(/-keybind$/,"-palette"),h=d.keybindId.replace(`${ve}.`,"");w.push({id:f,area:"palette",data:{id:`${ve}.${h.replace(/-keybind$/,"")}-palette`,action:`${ve}.${h.replace(/-keybind$/,"")}`,label:d.paletteLabel,keywords:[...o.paletteKeywords],run:Im(e,d.keybindId)}})}return w}),a={[`${ve}.undo-palette`]:["undo"],[`${ve}.toggle-priorities-palette`]:["priorities","quadrant"],[`${ve}.toggle-project-badges-palette`]:["project","badge"],[`${ve}.toggle-groups-palette`]:["expand","collapse","groups"],[`${ve}.toggle-answer-bars-palette`]:["answer","reply","yes","no","buttons"],[`${ve}.scan-palette`]:["scan","refresh"]};for(let d of n){if(d.area!=="palette"||!d.data||!("keywords"in d.data))continue;let m=a[d.data.id];m&&(d.data.keywords=[...o.paletteKeywords,...m])}e.registerMany([{id:"page",area:"routes",title:o.pluginName,data:{path:"/waiting-on-you"},render:()=>to(Dm,{ctx:e})},{id:"palette-open",area:"palette",data:{id:`${ve}.open`,action:`${ve}.open`,label:o.paletteOpen,keywords:[...o.paletteKeywords],run:()=>Xd(e)}},{id:"palette-toggle-panel",area:"palette",data:{id:`${ve}.open-palette`,action:`${ve}.open-keybind`,label:o.paletteTogglePanel,keywords:[...o.paletteKeywords,"show","hide","toggle","panel"],run:()=>ti(e)}},...n,{id:"palette-group-by-project",area:"palette",data:{id:`${ve}.group-by-project-palette`,action:`${ve}.group-by-project`,label:o.paletteGroupByProject,keywords:[...o.paletteKeywords,"group","project","sections"],run:()=>{op(e,()=>"project")}}},{id:"palette-teach",area:"palette",data:{id:`${ve}.teach-palette`,action:`${ve}.teach`,label:o.paletteTeach,keywords:[...o.paletteKeywords,"teach","priorities","sort","quiz","train"],run:()=>{if(!Ke()){ae(o.notOnThisProfile);return}Xd(e),xd()}}},{id:"composer-button",area:"composer.actions",order:50,render:()=>to(Ru,{ctx:e})}]),e.register({id:"statusbar-toggle",area:"statusBar.right",order:90,render:()=>to(Lm,{onToggle:()=>ti(e)})}),Jd(e),Ke()||Yd(e);let s=d=>{d?Rm(e):Yd(e)},l=Zt(()=>s(Ke())),c=()=>{typeof e.rest=="function"&&ku((d,m)=>e.rest(d,m))},p=yu([Je.state.profile,Je.state.connectionId,Je.state.focusedSessionProfile,Je.state.focusedSessionOwner],c);ir=()=>{l(),p()},c()}},jk=Om;export{kn as PANE_ID,jk as default};
