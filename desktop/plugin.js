import{host as et,useValue as gp}from"@hermes/plugin-sdk";import{useSyncExternalStore as cp}from"react";import{host as uo,useValue as na,Button as Go,Dialog as og,DialogContent as rg,DialogDescription as Mu,DialogFooter as Ns,DialogHeader as ag,DialogTitle as sg}from"@hermes/plugin-sdk";import{useCallback as Lu,useEffect as Wo,useState as kt,useSyncExternalStore as ig}from"react";var zr=["gray","red","orange","yellow","green","teal","blue","purple","pink"];function Lo(e){return zr.includes(e??"")?e:"gray"}function Xa(e){return e.status==="done"||e.status==="dismissed"||e.status==="expired"}var Wi=[1,2,3,4];function Kp(e){if(e.length===0)return"";let t=new Map;for(let s of e)t.set(s.topic,(t.get(s.topic)??0)+1);let o=e[0].topic,a=0;for(let[s,l]of t)l>a&&(o=s,a=l);return o||e[0].chat_title}function An(e,t=!1,o=!1){let a=e.title_override?.trim();if(a)return a;if(!o){let l=e.chat_name?.trim();if(l)return l}if(t){let l=e.chat_title?.trim();if(l)return l}return e.topic?.trim()||e.chat_title||""}function no(e,t=!1){if(e.title_locked){let a=e.title?.trim();if(a)return a}if(t){let a=e.chat_title?.trim();if(a)return a}return e.title?.trim()||e.chat_title||""}function Ki(e,t,o="newest"){let a=new Map;for(let m of e){let w=a.get(m.chat_key)??[];w.push(m),a.set(m.chat_key,w)}let s=new Map(t.map(m=>[m.chat_key,m])),l=[],c=o==="oldest"?(m,w)=>Pn(m)-Pn(w):(m,w)=>Pn(w)-Pn(m);for(let[m,w]of a)if(w.length>=2){let f=s.get(m),h=[...w].sort(c),$=o==="oldest"?Math.min(...w.map(b=>Pn(b))):Math.max(...w.map(b=>Pn(b))),v=f?.quadrant??Math.min(...w.map(b=>b.quadrant)),x={chat_key:m,title:f?.title??Kp(w),title_locked:f?.title_locked??!1,quadrant:v,task_ids:h.map(b=>b.id),agent:w[0].agent,chat_title:w[0].chat_title,chat_target:f?.chat_target??w.find(b=>b.chat_target)?.chat_target??null};l.push({kind:"group",group:x,tasks:h,sortAt:$})}else for(let f of w)l.push({kind:"task",task:f,sortAt:Pn(f)});let p={1:[],2:[],3:[],4:[]},d=o==="oldest"?(m,w)=>m.sortAt-w.sortAt:(m,w)=>w.sortAt-m.sortAt;for(let m of l){let w=m.kind==="task"?m.task.quadrant:m.group.quadrant;w>=1&&w<=4&&p[w].push(m)}for(let m of Wi)p[m].sort(d);return p}function Za(e){let t=0;for(let o of e)o.kind==="task"?t+=1:t+=o.tasks.length;return t}function Va(e){let t=new Date(e);return t.setHours(8,0,0,0),Math.floor(t.getTime()/1e3)}function en(e){let t=new Date(e);t.setDate(t.getDate()+1);let o=new Date(e),s=(8-o.getDay())%7;s===0&&(s=7),o.setDate(o.getDate()+s);let l=new Date(e);return l.setDate(l.getDate()+7),{tomorrow:Va(t),nextMonday:Va(o),inWeek:Va(l)}}var Qi={1:"Urgent & Important",2:"Important & Not Urgent",3:"Urgent & Not Important",4:"Not Urgent & Not Important"};function Hr(e){return e>=1&&e<=4?Qi[e]:`Quadrant ${e}`}function Br(e){if(!e||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e))return null;let t=new Date(e).getTime();return Number.isFinite(t)?Math.floor(t/1e3):null}function Oo(e){let t=new Date(e*1e3),o=a=>String(a).padStart(2,"0");return`${t.getFullYear()}-${o(t.getMonth()+1)}-${o(t.getDate())}T${o(t.getHours())}:${o(t.getMinutes())}`}function oo(e){let t=new Date(e);return t.setDate(t.getDate()+1),t.setHours(8,0,0,0),Oo(Math.floor(t.getTime()/1e3))}function Ja(e){return new Date(e*1e3).toLocaleString(void 0,{dateStyle:"medium",timeStyle:"short"})}function es(e){let t=e.source_msg_at;return t!=null&&Number.isFinite(t)&&t>0?t:e.updated_at}function Pn(e){let t=e.source_msg_at;return t!=null&&Number.isFinite(t)&&t>0?t:e.created_at}function Ur(e,t){if(!Number.isFinite(e))return"";let o=e*1e3,a=t.getTime()-o;if(a<6e4)return"just now";let s=Math.floor(a/6e4);if(s<60)return`${s} min ago`;let l=Math.floor(s/60);if(l<24)return l===1?"1 hour ago":`${l} hours ago`;let c=new Date(o);return c.toLocaleDateString(void 0,{month:"short",day:"numeric",year:t.getFullYear()!==c.getFullYear()?"numeric":void 0})}function Gr(e){return Number.isFinite(e)?new Date(e*1e3).toLocaleString(void 0,{dateStyle:"full",timeStyle:"short"}):""}function qi(e){let t=0;for(let o of e){let a=es(o);Number.isFinite(a)&&a>t&&(t=a)}return t}function Vi(e,t="newest"){let o=[...e[1],...e[2],...e[3],...e[4]],a=t==="oldest"?(s,l)=>s.sortAt-l.sortAt:(s,l)=>l.sortAt-s.sortAt;return o.sort(a),o}function Yi(e,t){if(!Number.isFinite(e))return"";let o=e*1e3,a=t.getTime()-o;if(a<6e4)return"just now";let s=Math.floor(a/6e4);if(s<60)return`${s} min ago`;let l=new Date(t);l.setHours(0,0,0,0);let c=new Date(l);if(c.setDate(c.getDate()-1),o>=c.getTime()&&o<l.getTime())return"yesterday";let p=Math.floor(s/60);return p<24?`${p} h ago`:new Date(o).toLocaleDateString(void 0,{month:"short",day:"numeric",year:t.getFullYear()!==new Date(o).getFullYear()?"numeric":void 0})}function Qp(e){return e.project?.key??null}function bt(e){return Array.isArray(e.tags)?e.tags:[]}function Xi(e){if(e==="all")return"all";if(e==="none")return["none"];if(typeof e=="string"&&e.trim()!=="")return[e];if(Array.isArray(e)){let t=[];for(let o of e)typeof o!="string"||o.trim()===""||t.includes(o)||t.push(o);return t.length===0?"all":t}return"all"}function Zi(e,t){if(e==="all")return"all";let o=new Set(t),a=e.filter(s=>s==="none"||o.has(s));return a.length===e.length?e:a.length===0?"all":a}function ts(e,t){if(e==="all")return[t];if(e.includes(t)){let o=e.filter(a=>a!==t);return o.length===0?"all":o}return[...e,t]}function Ji(e){if(!Array.isArray(e))return[];let t=[];for(let o of e){let a=typeof o=="number"?o:typeof o=="string"?Number(o):NaN;!Number.isInteger(a)||t.includes(a)||t.push(a)}return t}function el(e,t){let o=new Set(t),a=e.filter(s=>o.has(s));return a.length===e.length?e:a}function tl(e,t){return e.includes(t)?e.filter(o=>o!==t):[...e,t]}function nl(e){return e==="all"?!0:e.length>=2}function ns(e){let t=[],o=new Set;for(let a of e){let s=a.project;!s||o.has(s.key)||(o.add(s.key),t.push(s))}return t}function ol(e){let t=[],o=new Set;for(let a of e)for(let s of bt(a))o.has(s.id)||(o.add(s.id),t.push(s));return t}function Wr(e,t){if(e.length===0)return"none";let o=0;for(let a of e)bt(a).some(s=>s.id===t)&&(o+=1);return o===0?"none":o===e.length?"all":"some"}function rl(e,t=3){return e.length<=t?{shown:e,extra:0}:{shown:e.slice(0,t),extra:e.length-t}}function os(e,t,o,a=[]){if(t!=="all"&&e.agent!==t)return!1;if(o!=="all"){let s=Qp(e);if(!o.includes(s??"none"))return!1}if(a.length>0){let s=new Set(bt(e).map(l=>l.id));if(!a.every(l=>s.has(l)))return!1}return!0}function rs(e,t,o,a=[]){return t==="all"&&o==="all"&&a.length===0?e:e.filter(s=>os(s,t,o,a))}function as(e){let t=new Map;for(let a of e)t.set(a.chat_key,(t.get(a.chat_key)??0)+1);let o=0;for(let a of t.values())a>=2&&(o+=a);return{main:t.size,sub:o}}function qp(e){let t=0;for(let o of e)o.kind==="group"&&(t+=o.tasks.length);return{main:e.length,sub:t}}function ss(e){return is(qp(e))}function al(e){return`Show all ${ss(e)}`}function is(e){let t=`${e.main} ${e.main===1?"task":"tasks"}`;return e.sub===0?t:`${t}, ${e.sub} ${e.sub===1?"subtask":"subtasks"}`}function sl(e){return`All agents: ${is(e)}`}function il(e,t){return`${e}: ${is(t)}`}function ll(e){let t=new Map;for(let o of e)t.set(o.agent,[...t.get(o.agent)??[],o]);return[...t.entries()].map(([o,a])=>({agent:o,counts:as(a)})).sort((o,a)=>a.counts.main-o.counts.main||o.agent.localeCompare(a.agent))}var ul={debounce_seconds:[30,600],sweep_minutes:[15,240],max_chats_per_scan:[5,100],daily_call_cap:[0,2e3],lookback_days:[1,30],retention_days:[0,365]};function cl(e,t){let[o,a]=ul[e];if(!Number.isFinite(t))return o;let s=Math.trunc(t);return s<o?o:s>a?a:s}function dl(e,t){if(typeof t=="string"&&t.trim()==="")return"Must be a number";let o=typeof t=="number"?t:Number(t);if(!Number.isFinite(o)||!Number.isInteger(o))return"Must be a whole number";let[a,s]=ul[e];return o<a||o>s?`Must be between ${a} and ${s}`:null}function pl(e,t){switch(e){case"auto":return`after each chat, plus a check every ${t} min`;case"hourly":return"about every hour";case"manual":return"only when you tap Scan";case"off":return"only when you turn updates back on and scan"}}function gl(e){switch(e){case"manual":return"Manual";case"hourly":return"Hourly";case"off":return"Paused";default:return null}}function ml(e,t){return t>0&&e>=t}function Ya(e){return Number.isFinite(e)?Math.trunc(e).toLocaleString("en-US"):"0"}function ls(e,t){let o=Ya(e);return t<=0?`Today: ${o} checks used of no limit`:`Today: ${o} checks used of ${Ya(t)}`}function fl(e,t){return t<=0?0:Math.min(1,Math.max(0,e/t))}function Kr(e,t){switch(e){case"debounce_seconds":return t==="auto";case"sweep_minutes":return t==="auto"||t==="hourly";case"max_chats_per_scan":return t!=="off"}}function wl(e){return e<=0?"There is no daily limit on model calls.":`It stops after ${Ya(e)} model calls a day.`}function us(e){return e.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase()}function hl(e){let t=us(e.trim());return t?t.split(/\s+/).filter(Boolean):[]}function bl(e){return us(e.filter(t=>t!=null&&t!=="").join(`
`))}function jr(e,t,o={}){if(t.length===0)return!0;let a=o.nameAfterChat?An(e,!0):e.topic,s=bl([a,e.topic,e.title_override??"",e.ask,e.chat_title,e.agent,e.project?.name??"",...bt(e).map(l=>l.name),e.context??"",o.groupTitle??"",o.projectName??""]);return t.every(l=>s.includes(l))}function Vp(e,t,o,a=!1){if(o.length===0)return!1;let s=no(e,a),l=bl([s,e.title,e.chat_title,e.agent,t??""]);return o.every(c=>l.includes(c))}function yl(e,t,o,a=!1){if(t.length===0)return e;let s=[];for(let l of e){if(l.kind==="task"){jr(l.task,t,{nameAfterChat:a})&&s.push(l);continue}let c=o?o(l.group):ns(l.tasks).map(w=>w.name).join(" ")||null,p=no(l.group,a),m=Vp(l.group,c,t,a)?l.tasks:l.tasks.filter(w=>jr(w,t,{groupTitle:p,projectName:c,nameAfterChat:a}));m.length>0&&s.push({...l,tasks:m})}return s}function Yp(e){let t=[],o="";for(let a=0;a<e.length;a++){let s=us(e[a]);if(s)for(let l=0;l<s.length;l++)o+=s[l],t.push(a)}return{norm:o,toOrig:t}}function kl(e,t){let o=e?.connectionId?.trim();if(!o||o==="local")return;let a=t?.trim();if(!(a&&o===a))return o}function xl(e,t,o,a){let s={session_id:e,profile:t||"default"},l=kl(o,a);return l&&(s.connection_id=l),s}function vl(e,t,o,a,s){let l={session_id:e,profile:t||"default",quadrant:s.quadrant},c=kl(o,a);return c&&(l.connection_id=c),s.ask!=null&&s.ask!==""&&(l.ask=s.ask),s.title!=null&&s.title!==""&&(l.title=s.title),l}function cs(e,t){let o=t?.quadrant;if(o!=null&&o>=1&&o<=4)return o;if(e.length>0){let a=e[0].quadrant;if(a>=1&&a<=4)return a}return 2}function Fo(e,t){return e.length===1?{kind:"task",taskId:e[0].id}:{kind:"group",chatKey:t}}function Tl(e){return e.map(t=>t.id)}var jo="waiting-on-you:tasks-changed",ds="waiting-on-you:settings-changed";function ps(){typeof globalThis<"u"&&"dispatchEvent"in globalThis&&globalThis.dispatchEvent(new CustomEvent(jo))}function gs(){typeof globalThis<"u"&&"dispatchEvent"in globalThis&&globalThis.dispatchEvent(new CustomEvent(ds))}function Sl(e,t){if(!e||t.length===0)return[];let{norm:o,toOrig:a}=Yp(e);if(!o)return[];let s=[];for(let c of t){if(!c)continue;let p=0;for(;p<=o.length-c.length;){let d=o.indexOf(c,p);if(d===-1)break;let m=a[d],w=a[d+c.length-1]+1;s.push([m,w]),p=d+1}}s.sort((c,p)=>c[0]-p[0]);let l=[];for(let c of s){let p=l[l.length-1];p&&c[0]<=p[1]?p[1]=Math.max(p[1],c[1]):l.push([c[0],c[1]])}return l}function Cl(e,t,o){let a=e.trim(),s=o?.trim()??"";return a===s||a===t.trim()&&!o?.trim()?{action:"close"}:{action:"save",value:a||null}}function Nl(e,t,o){let a=e.trim(),s=!!o.title_locked,l=s?o.title?.trim()??"":"";return a===t.trim()&&(!s||a===l)?{action:"close"}:{action:"save",value:a||null}}function ro(e,t){return e==="priority"||e==="project"||e==="none"?e:t===!1?"none":"priority"}function Qr(e){return e==="compact"||e==="focus"?e:"cards"}function Pl(e){let t=e[0]?.agent;return e.some(o=>o.agent!==t)}function Al(e,t){let o=e==null?[t]:e.map(a=>a.entries);for(let a of o)for(let s of a){if(s.kind==="task")return{task:s.task,group:null,groupSize:1};let l=s.tasks[0];if(l)return{task:l,group:s.group,groupSize:s.tasks.length}}return null}function _l(e){return e==="priority"?"none":"priority"}var $l="no-project";function Xp(e){return e==null?$l:`project:${e}`}function Zp(e){if(e.kind==="task")return e.task.project??null;for(let t of e.tasks)if(t.project)return t.project;return null}function ms(e){return e.kind==="group"?e.group.chat_key:e.task.chat_key}function El(e,t){let o=new Map,a=[];for(let l of e){let c=Zp(l);if(!c){a.push(l);continue}let p=Xp(c.key),d=o.get(p);d||(d={key:p,title:c.name,entries:[]},o.set(p,d)),d.entries.push(l)}let s=[...o.values()].sort((l,c)=>l.title.localeCompare(c.title,void 0,{sensitivity:"base"})||l.key.localeCompare(c.key));return a.length>0&&s.push({key:$l,title:t,entries:a}),s}function Rl(e,t=Qi){return Wi.map(o=>({key:String(o),title:t[o],entries:e[o]}))}function Gi(e){let t=new Date(e);return t.setHours(0,0,0,0),t.getTime()}function Il(e,t){if(!Number.isFinite(e)||e<=0)return null;let o=new Date(e*1e3),a=1440*60*1e3,s=Math.round((Gi(o)-Gi(t))/a);if(s<0)return{label:"Overdue",tone:"overdue"};if(s===0)return{label:"Due today",tone:"today"};if(s===1)return{label:"Due tomorrow",tone:"soon"};if(s<7)return{label:`Due ${o.toLocaleDateString("en-US",{weekday:"short"})}`,tone:"soon"};let l=o.getFullYear()===t.getFullYear();return{label:`Due ${o.toLocaleDateString("en-US",{month:"short",day:"numeric",year:l?void 0:"numeric"})}`,tone:"later"}}function Dl(e){let t=null;for(let o of e){let a=o.due_at;a==null||!Number.isFinite(a)||a<=0||(t==null||a<t)&&(t=a)}return t}var n={pluginName:"Waiting On You",paletteOpen:"Open Waiting On You",paletteUndo:"Waiting On You: Undo last action",paletteKeywords:["waiting","tasks","todo","quadrant","covey"],keybindUndoLabel:"Undo last Waiting On You action",keybindTogglePriorities:"Toggle Waiting On You priorities",keybindToggleProjectBadges:"Toggle Waiting On You project badges",keybindToggleAllGroups:"Expand or collapse all Waiting On You groups",keybindToggleAnswerBars:"Show Waiting On You answer buttons on every task",paletteToggleAnswerBars:"Waiting On You: Answer buttons on every task",settingsShortcutToggleAnswerBars:"Answer buttons on every task",settingsShortcutAnswerKeys:"Answer the selected task",settingsShortcutAnswerKeysHint:"Y yes \xB7 N no \xB7 R reply \xB7 L later \xB7 O open \xB7 J/K move",answerBarsAllOn:"Answer buttons on every task",answerBarsAllOff:"Answer buttons on the selected task only",answerYes:"Yes",answerNo:"No",answerReply:"Reply",answerLater:"Later",answerDone:"Done",answerYesTip:"Send \u201CYes\u201D to the agent (Y)",answerNoTip:"Send \u201CNo\u201D to the agent (N)",answerReplyTip:"Type an answer for the agent (R)",answerLaterTip:"Snooze until tomorrow 8 AM (L)",answerOpenTip:"Open the chat (O)",answerDoneTip:"Mark done without telling the agent",answerBarRegion:"Answer this task",answerReplyLabel:"Your answer",answerReplyPlaceholder:"Type your answer",answerReplySend:"Send",answerReplyCancel:"Cancel",answerReplyHint:"Enter sends \xB7 Shift+Enter new line \xB7 Esc cancels",answerWaiting:e=>`Sending \u201C${e}\u201D in a few seconds\u2026`,answerSending:e=>`Sending \u201C${e}\u201D\u2026`,answerUndo:"Undo",answerSent:(e,t)=>`Sent \u201C${e}\u201D to ${t}.`,answerUnsupported:"An inline answer isn\u2019t available for this chat. Open it and answer there.",answerNotSent:e=>`Couldn\u2019t send your answer to ${e}. Nothing was sent, and the ask is still open.`,answerGone:e=>`${e} was already closed, so your answer wasn\u2019t sent.`,answerCancelled:"Answer not sent.",answerAlreadyPending:"That ask already has an answer on the way.",keybindScan:"Scan Waiting On You now",keybindOpen:"Show or hide Waiting On You",paletteTogglePanel:"Waiting On You: Show or hide panel",paneHiddenNotify:"Waiting On You hidden. Press \u2318\u2325Y to show it.",statusBarHidePane:"Hide Waiting On You (\u2318\u2325Y)",statusBarShowPane:"Show Waiting On You (\u2318\u2325Y)",hidePaneHeader:"Hide panel (\u2318\u2325Y)",prioritiesOn:"Priorities on",prioritiesOff:"Priorities off",groupedByNone:"No grouping",projectBadgesOn:"Project badges on",projectBadgesOff:"Project badges off",paletteTogglePriorities:"Waiting On You: Toggle priorities",paletteToggleProjectBadges:"Waiting On You: Toggle project badges",paletteToggleAllGroups:"Waiting On You: Expand or collapse all groups",paletteScan:"Waiting On You: Scan now",paletteGroupByProject:"Waiting On You: Group by project",groupedByProject:"Grouped by project",groupedByPriority:"Grouped by priority",updatedPrefix:"Updated",presenceGroupAria:"Chat activity",presenceWorking:"Working",presenceWorkingAria:e=>`${e} is working on a reply in this session`,presenceResponded:"Responded",presenceRespondedAria:e=>`${e} has started a reply in this session`,presenceRespondedUnavailable:"Responded unknown",presenceRespondedUnavailableAria:"Responded status is not available through the public plugin API on this host",presenceReadUnavailable:"Read unknown",presenceReadUnavailableAria:"Read status is not available through the public plugin API on this host",scanNow:"Scan now",scanning:"Scanning\u2026",scanningHint:"Reading your chats\u2026",scanDone:(e,t,o=0)=>`Scan done: ${e} new, ${t} resolved${o?`, ${o} cleared for age`:""}`,scanModelUnreachable:"Couldn\u2019t reach your Hermes model, so no chats were checked. Make sure Hermes can chat, then press Scan now.",scanSomeChatsFailed:e=>`Some chats couldn\u2019t be checked: ${e}`,scanLocked:"A scan is already running. Try again when it finishes.",scanRateLimited:"A scan just ran. Try again in a few seconds.",scanFailed:"Scan failed. Try again.",scanCapped:"Daily limit reached.",scanAnyway:"Scan anyway",scanTryAgain:"Try again",scanUpdatesOff:"Updates are off. Turn them on in settings.",headerDailyLimit:"Daily limit reached",storageLabelWarning:(e,t,o)=>`Can't read ${t} recent ${t===1?"chat":"chats"}${e?` from ${e}`:""}. Hermes now saves ${t===1?"it":"them"} under a new label ("${o}"). Update Waiting On You.`,machineOfflineCached:(e,t)=>`${e} can't be reached. Showing its chats from ${t}; new asks there are missed.`,machineOfflineNoCache:e=>`${e} can't be reached, so its chats are not on this list.`,firstRunLine1:"Finds what your AI agents are waiting on you for, and keeps it as a task list.",firstRunLine2:e=>`To do that, it sends the end of each changed chat to ${e}.`,firstRunLine3:(e,t,o)=>`It checks ${e}. ${t} It starts by looking back ${o} days.`,firstRunStart:"Start",firstRunChangeSettings:"Change settings first",settingsBack:"\u2039 Back",settingsTaskTitlesSection:"Task titles & chats",settingsSatellitesSection:"Other machines",satellitesIntro:"Install Waiting On You Satellite on each other Hermes so its chats show up here.",satellitesDisabled:e=>`Satellites can't connect to this Hermes right now: ${e}. Chats from other machines still come in over SSH if you set that up.`,satellitesEmpty:"No other machines yet.",satellitesAdd:"Add a machine",satellitesName:"Name",satellitesNameHint:"Short id, e.g. studio. One per Hermes (each profile on a Mac needs its own). Moving a machine off SSH? Use the same name so its tasks carry over.",satellitesAgentName:"Agent name",satellitesAgentHint:'e.g. "Juno"',satellitesConnection:"Desktop connection name",satellitesConnectionHint:"So clicking a task opens the chat on that machine",satellitesHubAddress:"Hub address",satellitesHubAddressHint:"This Hermes dashboard's address as the other machine sees it (the dashboard port, 9119 by default). Examples: https://hub.example.ts.net (Tailscale Serve) or http://192.168.1.10:9119 (LAN private IP). HTTP requires localhost or a literal private, loopback, or CGNAT IP; hostnames require HTTPS. Plain HTTP sends the satellite token and chat excerpts unencrypted. Prefer HTTPS.",satellitesHttpPublicWarning:"The satellite refuses plain HTTP to public IP addresses or hostnames, including .local. Use HTTPS.",satellitesCreateCode:"Create pairing code",satellitesCancel:"Cancel",satellitesCopyCommand:"Copy command",satellitesCodeExpiry:"Code works once and expires in 10 minutes",satellitesPairStep1:"Copy the satellite folder to ~/.hermes/plugins/waiting-on-you-satellite on that machine.",satellitesPairStep2:"Run hermes plugins enable waiting-on-you-satellite",satellitesPairStep3:"Run the command above on that machine.",satellitesPairStep4:"Restart that machine's Hermes gateway. Check it with hermes waiting-on-you-satellite status.",satellitesRemove:"Remove",satellitesRemoveConfirm:e=>`Remove ${e}? It will stop sending chats until you pair it again.`,satellitesNameInvalid:"Use lowercase letters, numbers, hyphens, or underscores (max 32 characters).",satellitesHubRequired:"Enter the hub address other machines should use.",satellitesPairErrorGeneric:"Could not create a pairing code. Try again.",satellitesPairErrorName:"That name is not allowed or is already in use.",satellitesPairErrorTooMany:"Too many active pairing codes. Wait or remove an old machine.",satellitesRevokeError:"Could not remove this machine. Try again.",satellitesLoadError:"Could not load other machines.",satellitesStatusWaiting:"Waiting for first update",satellitesStatusSending:e=>`Sending tasks \xB7 updated ${e}`,satellitesStatusUpdatedJustNow:"just now",satellitesStatusUpdatedMin:e=>`${e} min ago`,satellitesStatusLastHours:e=>`Last update ${e} h ago`,satellitesStatusLastDays:e=>`Last update ${e} days ago`,settingsFrequencySection:"How often it checks",settingsUsageSection:"Usage",settingsAdvanced:"Advanced",settingsModeAutoTitle:"Automatic (recommended)",settingsModeAutoDesc:e=>`After each chat reply, plus a check every ${e} minutes.`,settingsModeHourlyTitle:"Every hour",settingsModeHourlyDesc:"One check an hour.",settingsModeManualTitle:"Only when I press refresh",settingsModeManualDesc:"Nothing runs on its own.",settingsModeOffTitle:"Paused",settingsModeOffDesc:"Stops checking. Your list stays as it is.",settingsUsageModel:e=>`Uses ${e}.`,settingsUpdates:"Updates",settingsCost:"Cost",settingsChats:"Chats",settingsBehavior:"Behavior",settingsMode:"Mode",modeAuto:e=>`Auto: After each chat, plus a check every ${e} min`,modeHourly:"Hourly",modeManual:"Manual only",modeOff:"Off",settingsSweep:"Check every (minutes)",settingsDebounce:"Wait after a reply before checking (seconds)",settingsMaxChats:"Most chats per check",settingsModel:"Model",settingsModelHint:"To change it, set auxiliary.waiting_on_you in Hermes config.",settingsDailyCap:"Daily check limit",settingsDailyCapHint:"0 means no limit. Checks you start yourself (Scan anyway, name with AI) can go past it.",settingsUsageOver:e=>e>0?`Over the limit because you started ${e} ${e===1?"check":"checks"} yourself. Background checks stop at the limit.`:"Checks you start yourself can go past the limit. Background checks stop at it.",settingsUsageHistory:"Past 7 days",settingsLookback:"How far back to look (days)",settingsRetention:"Keep unanswered tasks for (days)",settingsRetentionHint:"0 = Forever (the default). Expiry is opt-in: inactive tasks are cleared for age, not marked answered. Future snoozes, future due dates, manual tasks, and locked priorities are protected.",whyHere:"Why is this here?",listEmpty:"Nothing is waiting on you.",listEmptyScan:e=>`Last scan ${e}.`,section1:"Urgent & Important",section2:"Important & Not Urgent",section3:"Urgent & Not Important",section4:"Not Urgent & Not Important",quadrantBar1:"Urgent & Important",quadrantBar2:"Important & Not Urgent",quadrantBar3:"Urgent & Not Important",quadrantBar4:"Not Urgent & Not Important",sortNewest:"Newest first",sortOldest:"Oldest first",sortLabel:"Sort",settings:"Settings",settingsLoading:"Loading settings\u2026",settingsLoadError:"Could not load settings.",projectsLoadError:"Could not load Hermes projects.",retry:"Retry",settingsShortcutsSection:"Keyboard shortcuts",settingsShortcutsFooter:"Change these in Desktop keyboard settings.",settingsShortcutOpen:"Show or hide panel",settingsShortcutUndo:"Undo",settingsShortcutTogglePriorities:"Toggle priorities",settingsShortcutToggleProjectBadges:"Toggle project badges",settingsShortcutToggleAllGroups:"Expand or collapse all groups",settingsShortcutScan:"Scan now",settingsShortcutCollapseGroups:"Collapse or expand all groups",settingsShortcutCollapseGroupsHint:"\u2325 + click triangle",archiveChatOnDone:"Archive the chat when its last task is done",archiveChatHelp:"The chat leaves your chat list. Undo or Reopen brings it back.",agentFilterAll:"All agents",agentFilterLabel:"Agent",clearFilters:"Clear",openSession:"Open session",handleWithAgent:e=>`Handle with ${e}`,actionRunningSuffix:"\u2026",nameAfterChat:"Name tasks after their chat",nameAfterChatHelp:"Use the chat's name as the task title. Tasks you renamed keep your name.",groupByLabel:"Group tasks by",groupByHelp:"Priority uses the four Urgent & Important sections. Project uses your Hermes projects.",groupByPriority:"Priority",groupByProject:"Project",groupByNone:"None",filtersButton:"Filter and sort",filtersButtonActive:"Filter and sort (filters on)",filtersSummary:"Showing",layoutLabel:"Layout",layoutHelp:"Cards keep each chat in its own box. Compact fits more on screen. Next up shows the one thing to do first.",layoutCards:"Cards",layoutCompact:"Compact",layoutFocus:"Next up",nextUpKicker:"Next up",nextUpDone:"Done",nextUpLater:"Later",nextUpLaterTip:"Snooze until tomorrow 8 AM",nextUpRegion:"Next task to handle",askShowDetails:"Show details",askHideDetails:"Hide details",followSelectedChat:"Follow selected chat",followSelectedChatHelp:"Center and highlight the card for the chat you select in the sidebar.",showProjectBadges:"Show project badges",showProjectBadgesHelp:"Show the Hermes project on each task card. Click one to see only that project.",projectFilterLabel:"Project",projectFilterAll:"All projects",projectFilterNone:"No project",projectFilterMany:e=>`${e} projects`,projectFilterEmpty:"No Hermes projects yet.",projectBadgeTip:e=>`Show only ${e}`,sectionNoProject:"No project",renameKeyboardHint:"Enter to save \xB7 Esc to cancel",tagFilterLabel:"Tag",tagFilterAll:"All tags",tagFilterMany:e=>`${e} tags`,tagFilterHint:"Shows tasks that have every tag you pick.",tagFilterEmpty:"No tags yet. Add them in Settings.",tagsSection:"Tags",tagsIntro:"Your own labels for tasks. Add or remove them from a card\u2019s \u22EF menu.",tagsEmpty:"No tags yet.",tagAdd:"Add tag",tagNew:"New tag\u2026",tagNewTitle:"New tag",tagNewDescription:"Pick a name and a color.",tagNewDescriptionApply:"Pick a name and a color. It goes on this task too.",tagName:"Name",tagNamePlaceholder:"e.g. Waiting on reply",tagColor:"Color",tagCreate:"Create",tagCreated:"Tag created",tagRename:e=>`Rename ${e}`,tagChangeColor:e=>`Change color of ${e}`,tagHintLabel:"Helps the AI pick this tag",tagHintPlaceholder:"Optional",tagOpenCount:e=>`${e} open`,tagDelete:"Delete",tagDeleteConfirm:e=>`Delete the tag \u201C${e}\u201D? It comes off every task.`,tagNameInvalid:"Use 1 to 32 characters.",tagSaveError:"Could not save the tag.",tagAddedByAi:"Added by AI",tagMoreTitle:e=>`Also: ${e}`,tagColorName:e=>e.charAt(0).toUpperCase()+e.slice(1),autoTag:"Let AI add your tags",autoTagHelp:"Uses only tags you made. If you remove one, it stays off that task.",menuSectionTags:"Tags",undoTags:"Tags changed.",undoGroupTags:"Tags changed for all.",dueOverdueTip:"Past its due date",pendingDoneChatArchived:"Done \xB7 chat archived",sectionEmpty:"Nothing here.",pendingDone:"Done",pendingDismissed:"Dismissed",markDone:e=>`Mark done: ${e}`,markGroupDone:e=>`Mark all done: ${e}`,markAllDone:e=>`Mark all ${e} done?`,markAllDoneYes:e=>`Mark all ${e} done`,closeAllTasks:"Close all tasks",groupOptionClickHint:"Tip: Option-click the checkbox to close every task at once.",groupCheckboxTip:"Click to close all tasks \xB7 Option-click to skip the question",dismissTip:"Dismiss tip",yes:"Yes",no:"No",groupExpand:"Show tasks in group",groupChevronTip:"Option-click to collapse or expand all",groupCollapse:"Hide tasks in group",groupAsksCount:e=>e===1?"1 ask":`${e} asks`,menuMoreForAsk:e=>`More actions for ${e}`,notATaskAll:"Remove all \u2014 not real tasks",snoozeAllTomorrow:"Snooze all: Tomorrow 8 AM",snoozeAllMonday:"Snooze all: Next Monday 8 AM",snoozeAllWeek:"Snooze all: In 1 week",snoozeAllCustom:"Snooze all: Pick date and time\u2026",rename:"Rename",renameSave:"Save",renameCancel:"Cancel",renameWithAi:"Rename with AI",renameWithAiBusy:"Naming\u2026",renameWithAiPending:"Naming with AI\u2026",renameWithAiFailed:"Could not name it with AI.",renameWithAiSame:"AI picked the same name.",renameWithAiTip:"Write a name from this chat. Tip: hold \u2325 in the \u22EF menu to rename in one click.",renameAltHint:"\u2325",renameLabel:"Name",menuSectionSnooze:"Snooze",menuSectionPriority:"Priority",snoozeTomorrowShort:"Tomorrow 8 AM",snoozeMondayShort:"Next Monday",snoozeWeekShort:"In one week",snoozeCustomShort:"Custom\u2026",undoRename:"Name changed.",undoGroupDone:"Marked all done.",undoGroupDismissed:"Dismissed all.",undoGroupSnoozed:"Snoozed all.",undoGroupMoved:"Moved group.",notATask:"Remove \u2014 not a real task",snoozeTomorrow:"Snooze: Tomorrow 8 AM",snoozeMonday:"Snooze: Next Monday 8 AM",snoozeWeek:"Snooze: In 1 week",snoozeCustom:"Snooze: Pick date and time\u2026",snoozeSubmit:"Snooze",snoozeCancel:"Cancel",snoozePast:"Pick a time in the future.",moveToQuadrant:e=>`Move to: ${e}`,menuMore:"More actions",undoDone:"Marked done.",undoDismissed:"Dismissed.",undoSnoozed:"Snoozed.",undoMoved:"Moved.",undoMore:e=>`(${e} more)`,undo:"Undo",chatCopied:"Chat title copied. Open it with \u2318K.",chatContextReady:"New chat ready. Check the text, then send.",chatNewDraftBlocked:"Your new chat already has a draft, so it was left alone. Send or clear it, then try again.",chatOpenFailed:(e,t)=>`Could not open \u201C${e}\u201D: ${t}`,showClosed:"Show closed",hideClosed:"Hide closed",closedNote:"Done and dismissed items stay closed. Age-cleared tasks can return if asked again.",reopen:"Reopen",statusExpired:"Cleared for age \xB7 not answered",statusDone:"done",statusDismissed:"dismissed",quadrant1Badge:e=>e===1?"1 Urgent & Important":`${e} Urgent & Important`,loadError:"Could not load tasks.",notOnThisProfile:"Waiting On You isn't installed on this profile.",offline:"Can't reach Hermes. Retrying\u2026",patchError:"Could not update task.",alreadyCleared:"Already cleared",searchOpen:"Search (\u2318F)",searchPlaceholder:"Search tasks, chats, projects, tags\u2026",searchAria:"Search tasks",searchIncludeClosed:"Include closed",searchClose:"Close search",searchFilteredPrefix:"Filtered:",searchNoMatch:e=>`No tasks match \u201C${e}\u201D.`,searchClear:"Clear search",searchClosedSection:"Closed",composerButton:"Waiting On You",composerButtonTracked:e=>e===1?"Waiting On You (1 item)":`Waiting On You (${e} items)`,composerAddTitle:"Add to Waiting On You",composerTrackedTitle:"In Waiting On You",composerAddDescription:"Track this chat and choose where it goes.",composerAskLabel:"What's waiting on you?",composerClose:"Close",composerAskPlaceholder:"Follow up on this chat",composerAddAnother:"Add another item",composerMarkComplete:"Mark complete",composerAdded:"Added to Waiting On You",composerCompleted:"Marked complete",composerSnoozed:"snoozed",composerCancel:"Cancel",composerUntitled:"Untitled",composerAdd:"Add",composerQuadrantLabel:"Priority",teachTitle:"Teach priorities",paletteTeach:"Waiting On You: Teach priorities",teachIntro:"Sort a few tasks by hand. Your answers guide how new tasks are sorted.",teachProgress:(e,t)=>`Task ${e} of ${t}`,teachFiledAs:e=>`Filed as: ${e}`,teachQuadrant1:"Urgent and important",teachQuadrant1Hint:"Do it now",teachQuadrant2:"Important, not urgent",teachQuadrant2Hint:"Plan time for it",teachQuadrant3:"Urgent, not important",teachQuadrant3Hint:"Quick, or hand it off",teachQuadrant4:"Not urgent or important",teachQuadrant4Hint:"It can wait",teachSkip:"Skip",teachDone:"Done",teachKeysHint:"Keys: 1\u20134 to answer, S to skip.",teachLoading:"Loading tasks\u2026",teachLoadError:"Could not load tasks to sort.",teachSaveError:"Could not save that answer.",teachSaveRetry:"Pick again to retry.",teachFinished:e=>`Done. ${e} ${e===1?"task":"tasks"} sorted. Your answers now guide new tasks.`,teachFinishedNone:"Done. Nothing was sorted this time.",teachMore:"Do 10 more",teachEmpty:"Nothing left to sort. New tasks show up here after a scan.",teachEmptyNote:"Tasks you already moved yourself are not asked again.",prioritiesNoteSection:"What matters to you",prioritiesNoteLabel:"What matters to you",prioritiesNoteHelp:"Used when sorting new tasks. Example: Clients and family first. Content deadlines matter; tool tweaks can wait.",prioritiesNotePlaceholder:"Clients and family first\u2026",prioritiesNoteTooLong:"Keep it under 1,000 characters.",charCount:(e,t)=>`${e.toLocaleString("en-US")} / ${t.toLocaleString("en-US")}`,teachFromSettings:"Teach priorities\u2026",teachFromSettingsHelp:"Sort 10 tasks by hand so it learns how you rank things.",decisionSection:"Decision model (optional)",decisionIntro:"A small, fast model that answers yes/no and rating questions. Waiting On You can use one to skip chats with nothing waiting, rate priority, and add tags. Your main Hermes model still writes the tasks.",decisionProvider:"Provider",decisionProviderOff:"Off",decisionModel:"Model",decisionBaseUrl:"Base URL",decisionAccountId:"Account ID",decisionKeySaved:"Key: saved",decisionKeyNotSet:"Key: not set",decisionKeyPath:"Hermes Settings \u203A Plugins \u203A Waiting On You (or the gear next to it in Capabilities \u203A Plugins)",decisionKeyWhere:(e,t)=>t?`Add the key (${t}) in ${e}.`:`Add the key in ${e}.`,decisionNative:"Hermes has a built-in decision model; it will be used.",decisionTest:"Test",decisionTesting:"Testing\u2026",decisionTestOk:e=>`Works \u2014 ${e} ms`,decisionTestOkNoTime:"Works",decisionErr401:"The key was rejected.",decisionErr429:"Rate limited. Try again in a minute.",decisionErrTimeout:"No answer in time.",decisionErrNotConfigured:"Pick a provider and add its key first.",decisionTestFailed:e=>`Test failed (${e}).`,decisionTestFailedPlain:"Test failed.",decisionLoadError:"Could not load the decision model settings.",decisionSaveError:"Could not save the decision model.",decisionLastError:e=>`Last problem: ${e}`,decisionUsageToday:(e,t)=>`Today: ${e.toLocaleString("en-US")} ${e===1?"call":"calls"} \xB7 ${t.toLocaleString("en-US")} input tokens`,decisionGate:"Skip chats with nothing waiting",decisionGateHelp:"Asks the decision model first, so your main model only reads chats that need you.",decisionPriority:"Rate priority with the decision model",decisionPriorityHelp:"Rates how urgent and important each new task is.",decisionNeedsModel:"These only run when a decision model is set.",autoTagDecisionNote:"Uses the decision model when one is set.",tagSuggest:"Suggest tags",tagSuggesting:"Looking at your chats\u2026",tagSuggestNote:"Uses one AI call. Nothing is saved until you add it.",tagSuggestEmpty:"No new tag ideas. You may already have them.",tagSuggestError:"Could not suggest tags.",tagSuggestAdd:"Add",tagSuggestAdded:"Added",tagSuggestSkip:"Skip",tagSuggestAddAll:"Add all",tagSuggestExamples:e=>e===1?"1 recent task":`${e} recent tasks`,tagSuggestTaken:"You already have a tag with that name.",tagSuggestRename:e=>`Name for suggested tag ${e}`,firstRunStepOf:(e,t)=>`Optional step ${e} of ${t}`,firstRunDecisionTitle:"Pick a decision model (optional)",firstRunTagsTitle:"Suggest tags from your recent chats",firstRunTagsIntro:"Get a few tag ideas from your recent tasks. Add the ones you like.",teachCardTitle:"Teach priorities",teachCardIntro:"Sort 10 tasks by hand so new ones land in the right place. About 2 minutes.",teachCardStart:"Start",teachCardNotNow:"Not now",teachCardDismiss:"Dismiss",firstRunTeachEmpty:"No tasks to sort yet. We\u2019ll offer this again after a few scans.",firstRunTeachTitle:"Teach priorities now?",firstRunTeachIntro:"Sort 10 tasks by hand so new ones land in the right place. You can do this later from Settings.",firstRunTeachWait:"The first scan is still running. Tasks to sort show up when it finishes.",firstRunNext:"Next",firstRunSkip:"Skip for now",firstRunTeachNow:"Teach priorities now",firstRunLater:"Later",firstRunFinish:"Finish"};var qr=10,fs=1e3;function Jp(e){return e===1||e===2||e===3||e===4}function Ll(e){let t=e?.tasks;if(!Array.isArray(t))return[];let o=[];for(let a of t){let s=a;typeof s?.id!="number"||typeof s.ask!="string"||o.push({id:s.id,ask:s.ask,context:typeof s.context=="string"&&s.context.trim()?s.context:null,chat_title:typeof s.chat_title=="string"?s.chat_title:"",agent:typeof s.agent=="string"?s.agent:"",project:typeof s.project=="string"&&s.project?s.project:null,quadrant:Jp(s.quadrant)?s.quadrant:4,due_at:typeof s.due_at=="number"?s.due_at:null})}return o}var ws={status:"loading",items:[],index:0,sorted:0,busy:!1,error:null,moreAvailable:null};function Ml(e,t){let o=e.sorted+(t?1:0),a=e.index+1;return a>=e.items.length?{...e,index:a,sorted:o,busy:!1,error:null,status:"done",moreAvailable:null}:{...e,index:a,sorted:o,busy:!1,error:null}}function Ol(e,t){switch(t.type){case"load":return{...e,status:"loading",busy:!1,error:null};case"loaded":return t.items.length===0?e.sorted>0?{...e,status:"done",items:[],index:0,busy:!1,error:null,moreAvailable:!1}:{...ws,status:"empty"}:{...e,status:"ready",items:t.items,index:0,busy:!1,error:null,moreAvailable:null};case"loadFailed":return{...e,status:"error",busy:!1,error:t.error};case"submit":return e.status!=="ready"||e.busy?e:{...e,busy:!0,error:null};case"answered":return e.status==="ready"?Ml(e,!0):e;case"skipped":case"gone":return e.status==="ready"?Ml(e,!1):e;case"submitFailed":return{...e,busy:!1,error:t.error};case"more":return e.status==="done"?{...e,moreAvailable:t.available}:e;default:return e}}function Fl(e){return e.status!=="ready"?null:e.items[e.index]??null}function jl(e){return n.teachProgress(Math.min(e.index+1,e.items.length),e.items.length)}var hs=[{quadrant:1,label:n.teachQuadrant1,hint:n.teachQuadrant1Hint},{quadrant:2,label:n.teachQuadrant2,hint:n.teachQuadrant2Hint},{quadrant:3,label:n.teachQuadrant3,hint:n.teachQuadrant3Hint},{quadrant:4,label:n.teachQuadrant4,hint:n.teachQuadrant4Hint}];function eg(e){return hs.find(t=>t.quadrant===e)?.label??n.teachQuadrant4}function zl(e){return n.teachFiledAs(eg(e))}function Hl(e){return e.metaKey||e.ctrlKey||e.altKey?null:e.key==="1"||e.key==="2"||e.key==="3"||e.key==="4"?Number(e.key):e.key==="s"||e.key==="S"?"skip":null}function Bl(e){return[e.chat_title,e.agent,e.project].map(t=>(t??"").trim()).filter(Boolean).join(" \xB7 ")}function Ul(e){return e.ok?e.latency_ms!=null&&Number.isFinite(e.latency_ms)?n.decisionTestOk(Math.round(e.latency_ms)):n.decisionTestOkNoTime:tg(e.code)}function tg(e){switch(e){case"http_401":case"http_403":return n.decisionErr401;case"http_429":return n.decisionErr429;case"timeout":return n.decisionErrTimeout;case"not_configured":return n.decisionErrNotConfigured;case null:case void 0:case"":return n.decisionTestFailedPlain;default:return n.decisionTestFailed(e)}}function bs(e,t){let o=[...e].length;return{label:n.charCount(o,t),over:o>t,near:o>=Math.floor(t*.9)}}function ao(e){return e.trim().toLocaleLowerCase()}function Gl(e){let t=e?.suggestions;if(!Array.isArray(t))return[];let o=[];for(let a of t){let s=a;typeof s?.name!="string"||!s.name.trim()||o.push({name:s.name.trim().slice(0,32),color:Lo(typeof s.color=="string"?s.color:null),hint:typeof s.hint=="string"?s.hint.trim().slice(0,200):"",example_count:typeof s.example_count=="number"?s.example_count:0})}return o}function Wl(e,t){let o=new Set;for(let s of t)o.add(ao(s));let a=[];for(let s of e){let l=ao(s.name);!l||o.has(l)||(o.add(l),a.push({key:`${a.length}:${l}`,...s,status:"pending",error:null}))}return a}function ys(e){let t=e.trim().length;return t<1||t>32?n.tagNameInvalid:null}function Kl(e,t,o){return e.map(a=>a.key===t?{...a,name:o,error:null}:a)}function _n(e,t,o,a=null){return e.map(s=>s.key===t?{...s,status:o,error:a}:s)}function Ql(e,t){let o=new Set;for(let s of t)o.add(ao(s));let a=[];for(let s of e){if(s.status!=="pending"||ys(s.name))continue;let l=ao(s.name);o.has(l)||(o.add(l),a.push(s))}return a}function ql(e,t){let o=ao(e.name);for(let a of t)if(ao(a)===o)return!0;return!1}function Vl(e){return e.filter(t=>t.status==="pending"||t.status==="adding").length}async function Vr(e,t=!1){let o=t?"/tasks?include_closed=1":"/tasks";return e.rest(o)}async function jt(e,t,o){let a=encodeURIComponent(t);return e.rest(`/groups/${a}`,{method:"PATCH",body:o})}async function Yl(e,t){return(await e.rest("/ai-title",{method:"POST",body:t,timeoutMs:6e4})).title}async function Xl(e,t,o){return e.rest(`/tasks/${t}/actions/${o}`,{method:"POST",timeoutMs:12e4})}async function zt(e,t,o){return e.rest(`/tasks/${t}`,{method:"PATCH",body:o})}async function Zl(e){let t=await e.rest("/projects");return{projects:Array.isArray(t.projects)?t.projects:[],no_project_count:typeof t.no_project_count=="number"?t.no_project_count:0}}async function Jl(e){let t=await e.rest("/tags");return Array.isArray(t.tags)?t.tags:[]}async function ks(e,t){return(await e.rest("/tags",{method:"POST",body:t})).tag}async function eu(e,t,o){return(await e.rest(`/tags/${t}`,{method:"PATCH",body:o})).tag}async function tu(e,t){await e.rest(`/tags/${t}`,{method:"DELETE"})}async function xs(e,t,o){let a={};return o.add&&o.add.length>0&&(a.add=o.add),o.remove&&o.remove.length>0&&(a.remove=o.remove),(await e.rest(`/tasks/${t}/tags`,{method:"POST",body:a})).task}async function $n(e){return e.rest("/settings")}async function En(e,t){let o=await e.rest("/settings",{method:"PATCH",body:t});return gs(),o}async function nu(e,t){let o=t?.force?{force:!0}:{};return e.rest("/scan",{method:"POST",body:o,timeoutMs:18e4})}async function ou(e){return e.rest("/satellite/status")}async function ru(e){return(await e.rest("/satellites")).satellites}async function au(e,t){return e.rest("/satellite/pair-codes",{method:"POST",body:t})}async function su(e,t){await e.rest(`/satellites/${encodeURIComponent(t)}`,{method:"DELETE"})}async function zo(e,t=qr){let o=await e.rest(`/quiz?limit=${t}`);return Ll(o)}async function iu(e,t,o){await e.rest(`/quiz/${t}`,{method:"POST",body:{quadrant:o}})}async function lu(e,t){await e.rest(`/quiz/${t}/skip`,{method:"POST",body:{}})}function uu(e){let t=e??{};return{provider:typeof t.provider=="string"?t.provider:"",model:typeof t.model=="string"?t.model:"",base_url:typeof t.base_url=="string"?t.base_url:"",cloudflare_account_id:typeof t.cloudflare_account_id=="string"?t.cloudflare_account_id:"",key_set:!!t.key_set,key_name:typeof t.key_name=="string"&&t.key_name?t.key_name:null,native_available:!!t.native_available,providers:Array.isArray(t.providers)?t.providers:[],usage_today:{calls:typeof t.usage_today?.calls=="number"?t.usage_today.calls:0,input_tokens:typeof t.usage_today?.input_tokens=="number"?t.usage_today.input_tokens:0},last_error:typeof t.last_error=="string"&&t.last_error?t.last_error:null}}async function cu(e){return uu(await e.rest("/decision"))}async function du(e,t){let o=await e.rest("/decision",{method:"PATCH",body:t});return gs(),uu(o)}async function pu(e){let t=await e.rest("/decision/test",{method:"POST",body:{},timeoutMs:6e4});return{ok:!!t?.ok,code:typeof t?.code=="string"?t.code:null,latency_ms:typeof t?.latency_ms=="number"?t.latency_ms:null,model:typeof t?.model=="string"?t.model:null}}async function gu(e,t){let o=await e.rest("/tags/suggest",{method:"POST",body:t?{limit:t}:{},timeoutMs:9e4});return Gl(o)}function Yr(e){return ro(e.group_by,e.show_priorities)}import{jsx as re,jsxs as yt}from"react/jsx-runtime";function Xr({className:e}){return re("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:re("path",{d:"M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 3.5V7h-3.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})}function mu({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("circle",{cx:"7",cy:"7",r:"4.25",stroke:"currentColor",strokeWidth:"1.5"}),re("path",{d:"M10.2 10.2 13.5 13.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function Zr({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("rect",{x:"2",y:"2",width:"12",height:"12",rx:"3",stroke:"currentColor",strokeWidth:"1.5"}),re("path",{d:"M5 8.2 7.1 10.3 11 5.8",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"})]})}function fu({className:e}){return re("svg",{className:e,width:"14",height:"14",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:re("path",{d:"M11.5 2.5a1.8 1.8 0 0 1 2.5 2.5l-8 8-3.2.7.7-3.2 8-8Z",stroke:"currentColor",strokeWidth:"1.4",strokeLinejoin:"round"})})}function Ho({className:e}){return yt("svg",{className:e,width:"12",height:"12",viewBox:"0 0 12 12",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("path",{d:"M4.5 2.5H9.5V7.5M9.5 2.5L2.5 9.5",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),re("rect",{x:"2.5",y:"2.5",width:"7",height:"7",rx:"1",stroke:"currentColor",strokeWidth:"1.25"})]})}function wu({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("circle",{cx:"8",cy:"8",r:"3",stroke:"currentColor",strokeWidth:"1.5"}),re("path",{d:"M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function hu({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("rect",{x:"2.5",y:"3.5",width:"11",height:"10",rx:"1.5",stroke:"currentColor",strokeWidth:"1.5"}),re("path",{d:"M2.5 6.5h11M5.5 2v2M10.5 2v2",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function bu({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("rect",{x:"2.5",y:"3.5",width:"11",height:"10",rx:"1.5",stroke:"currentColor",strokeWidth:"1.5"}),re("path",{d:"M2.5 6.5h11M5.5 2v2M10.5 2v2",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),re("path",{d:"M8 9v3M6.5 10.5h3",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function yu({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("circle",{cx:"8",cy:"8",r:"5.5",stroke:"currentColor",strokeWidth:"1.5"}),re("path",{d:"M8 5v3.2l2 1.3",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]})}function ku({className:e}){return re("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:re("path",{d:"M8 4v8M4 8h8",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})})}function xu({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("circle",{cx:"8",cy:"8",r:"5.5",stroke:"currentColor",strokeWidth:"1.5"}),re("path",{d:"M8 7.2V11M8 5.5h.01",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function vu({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("path",{d:"M3.5 5.5h9M6 5.5V4.5h4v1",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),re("path",{d:"M5 5.5l.5 7h5l.5-7",stroke:"currentColor",strokeWidth:"1.5",strokeLinejoin:"round"})]})}function so({className:e}){return re("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:re("path",{d:"M4 8.2 6.8 11 12 5.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})}function Tu({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("path",{d:"M2.5 8c1.8-2.8 4.2-4.2 5.5-4.2s3.7 1.4 5.5 4.2c-1.8 2.8-4.2 4.2-5.5 4.2S4.3 10.8 2.5 8Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinejoin:"round"}),re("path",{d:"M8 9.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z",fill:"currentColor"}),re("path",{d:"M3 3l10 10",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}function Su({className:e}){return yt("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("path",{d:"M2.5 4.5h11M2.5 8h11M2.5 11.5h11",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),re("circle",{cx:"5.5",cy:"4.5",r:"1.25",stroke:"currentColor",strokeWidth:"1.25"}),re("circle",{cx:"10.5",cy:"8",r:"1.25",stroke:"currentColor",strokeWidth:"1.25"}),re("circle",{cx:"6.5",cy:"11.5",r:"1.25",stroke:"currentColor",strokeWidth:"1.25"})]})}function Cu({className:e}){return re("svg",{className:e,width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:re("path",{d:"M2.5 3.5h11l-4.25 5v4l-2.5 1v-5l-4.25-5z",stroke:"currentColor",strokeWidth:"1.4",strokeLinejoin:"round"})})}function gn({className:e}){return yt("svg",{className:e,width:"14",height:"14",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[re("path",{d:"M7 2.5 8.1 5.9 11.5 7 8.1 8.1 7 11.5 5.9 8.1 2.5 7 5.9 5.9Z",stroke:"currentColor",strokeWidth:"1.3",strokeLinejoin:"round"}),re("path",{d:"M12.5 10.5v3M11 12h3",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})]})}function Jr(e){return typeof e=="string"?e:""}function De(e){let t=e??{},o=typeof t.status=="number"?t.status:typeof t.statusCode=="number"?t.statusCode:0,a=Jr(t.body?.error)||Jr(t.body?.detail),s=typeof t.message=="string"?t.message:"",l=/(\d{3}): (.*)$/s.exec(s);if(l&&(o||(o=Number(l[1])),!a))try{let c=JSON.parse(l[2]);a=Jr(c.error)||Jr(c.detail)}catch{}return{status:o,error:a||s}}function io(e){let{status:t,error:o}=De(e);return t===404&&/^(task|group) not found$/i.test(o.trim())}function vs(e){let{status:t,error:o}=De(e);return t===404&&/plugin not found/i.test(o)}async function ea(e,t,o,a,s){let l=xl(t,o,a,s),c=new URLSearchParams(l).toString();try{return{kind:"ok",data:await e.rest(`/session-tasks?${c}`)}}catch(p){let{status:d,error:m}=De(p);if(d===404)return{kind:"not_found",error:m||"Not found"};throw p}}async function Nu(e,t,o,a,s,l){let c=vl(t,o,a,s,l),p=await e.rest("/tasks",{method:"POST",body:c});return ps(),p.task}function Bo(){ps()}var ta=!0,Ss=new Set;function Ke(){return ta}function Uo(e){if(ta!==e){ta=e;for(let t of Ss)t()}}function tn(e){return Ss.add(e),()=>Ss.delete(e)}function lo(){let e=ta;return Uo(!1),e}function mn(e){return vs(e)}function Pu(e,t){let o=e.map(a=>a&&typeof a.subscribe=="function"?a.subscribe(t):()=>{});return()=>{for(let a of o)a()}}var Ts=0;async function Au(e){let t=++Ts;try{if(await e("/settings",{timeoutMs:8e3}),t!==Ts)return;Uo(!0)}catch(o){if(t!==Ts)return;vs(o)&&Uo(!1)}}var r="wou-root",_u=`
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
`,Rn=`
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
  border: 1px solid color-mix(in srgb, var(--wou-accent) 55%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 14%, var(--wou-card));
  padding-left: 8px;
  padding-right: 8px;
  margin: 2px 0;
}
.${r} .wou-group-follow-selected > .wou-group-parent {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--wou-accent) 55%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 14%, var(--wou-card));
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
.${r} .wou-satellites-intro {
  margin: 0 0 10px;
  font-size: 12px;
}
.${r} .wou-satellites-warn-line {
  margin: 0 0 10px;
  font-size: 12px;
}
.${r} .wou-satellite-list {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
}
.${r} .wou-satellite-list-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--wou-border);
  font-size: 12px;
}
.${r} .wou-satellite-list-item:first-child {
  border-top: none;
  padding-top: 0;
}
.${r} .wou-satellite-list-name {
  font-weight: 500;
  flex: 1 1 auto;
  min-width: 0;
}
.${r} .wou-satellite-list-status {
  flex: 1 1 100%;
  font-size: 11px;
}
@media (min-width: 360px) {
  .${r} .wou-satellite-list-status {
    flex: 1 1 auto;
    text-align: right;
  }
}
.${r} .wou-satellite-status-warn {
  color: var(--dt-destructive, #c2410c);
}
:root.dark .${r} .wou-satellite-status-warn {
  color: var(--dt-destructive, #fb923c);
}
.${r} .wou-satellite-form input[type="text"] {
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--wou-card);
  color: var(--wou-fg);
  max-width: 100%;
}
.${r} .wou-satellite-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.${r} .wou-satellite-command {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}
.${r} .wou-satellite-pair-result {
  margin-top: 8px;
}
.${r} .wou-satellite-steps {
  margin: 8px 0;
  padding-left: 1.25rem;
  font-size: 12px;
}
.${r} .wou-satellite-steps code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
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
  border-color: color-mix(in srgb, var(--wou-accent) 55%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 14%, var(--wou-card));
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

/* ---- Answer bar: Yes \xB7 No \xB7 Reply \xB7 Later \xB7 Open session ---- */
/* The selected task: a quiet accent edge, so it reads apart from the followed-chat box. */
.${r} .wou-row.wou-row-active { box-shadow: inset 3px 0 0 var(--wou-accent); }
.${r} .wou-row[data-wou-task-id]:focus { outline: none; }
.${r} .wou-answer { margin-top: 8px; }
.${r} .wou-answer-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.${r} .wou-answer-bar .wou-action-btn { font-size: 12px; padding: 3px 10px; }
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
`;import{host as ng}from"@hermes/plugin-sdk";var $u=ng.notify;function ie(e){$u({kind:"info",message:e})}function de(e,t){$u(t?{kind:"error",message:e,detail:t}:{kind:"error",message:e})}var ut="waiting-on-you-desktop",In=`plugin.${ut}.tasks.changed`,Ru=`plugin.${ut}.settings.changed`,Cs=[{registerSlotId:"open-keybind",keybindId:`${ut}.open-keybind`,keybindLabel:n.keybindOpen,settingsLabel:n.settingsShortcutOpen,defaults:["mod+alt+y"],category:"view"},{registerSlotId:"undo-keybind",keybindId:`${ut}.undo`,keybindLabel:n.keybindUndoLabel,settingsLabel:n.settingsShortcutUndo,paletteLabel:n.paletteUndo,defaults:["mod+z"],category:"view"},{registerSlotId:"toggle-priorities-keybind",keybindId:`${ut}.toggle-priorities`,keybindLabel:n.keybindTogglePriorities,settingsLabel:n.settingsShortcutTogglePriorities,paletteLabel:n.paletteTogglePriorities,defaults:["mod+alt+p"],category:"view"},{registerSlotId:"toggle-project-badges-keybind",keybindId:`${ut}.toggle-project-badges`,keybindLabel:n.keybindToggleProjectBadges,settingsLabel:n.settingsShortcutToggleProjectBadges,paletteLabel:n.paletteToggleProjectBadges,defaults:["mod+alt+b"],category:"view"},{registerSlotId:"toggle-groups-keybind",keybindId:`${ut}.toggle-groups`,keybindLabel:n.keybindToggleAllGroups,settingsLabel:n.settingsShortcutToggleAllGroups,paletteLabel:n.paletteToggleAllGroups,defaults:["mod+alt+e"],category:"view"},{registerSlotId:"toggle-answer-bars-keybind",keybindId:`${ut}.toggle-answer-bars`,keybindLabel:n.keybindToggleAnswerBars,settingsLabel:n.settingsShortcutToggleAnswerBars,paletteLabel:n.paletteToggleAnswerBars,defaults:["mod+alt+a"],category:"view"},{registerSlotId:"scan-keybind",keybindId:`${ut}.scan`,keybindLabel:n.keybindScan,settingsLabel:n.settingsShortcutScan,paletteLabel:n.paletteScan,defaults:["mod+alt+r"],category:"view"}],Iu=[...Cs.map(e=>({id:e.keybindId,label:e.settingsLabel,display:{kind:"combo",combo:e.defaults[0]}})),{id:`${ut}.answer-keys`,label:n.settingsShortcutAnswerKeys,display:{kind:"hint",text:n.settingsShortcutAnswerKeysHint}},{id:`${ut}.option-click-groups`,label:n.settingsShortcutCollapseGroups,display:{kind:"hint",text:n.settingsShortcutCollapseGroupsHint}}],Eu={mod:"\u2318",alt:"\u2325",shift:"\u21E7",ctrl:"\u2303"};function Du(e){return e.split("+").map(t=>t.trim()).filter(Boolean).map(t=>{let o=t.toLowerCase();return o in Eu?Eu[o]:(t.length===1,t.toUpperCase())})}import{Fragment as Ps,jsx as pe,jsxs as Ze}from"react/jsx-runtime";var Ou=In,lg=[1,2,3,4],ug={1:n.quadrantBar1,2:n.quadrantBar2,3:n.quadrantBar3,4:n.quadrantBar4};function cg(e,t){let o=e.ask?.trim();return o||An(e,t)||n.composerUntitled}function Fu({value:e,disabled:t,onChange:o}){return pe("div",{className:"wou-quadrant-grid",role:"radiogroup","aria-label":n.composerQuadrantLabel,children:lg.map(a=>Ze("label",{className:"wou-quadrant-option",children:[pe("input",{type:"radio",name:"wou-quadrant",value:a,checked:e===a,disabled:t,onChange:()=>o(a)}),pe("span",{children:ug[a]})]},a))})}function ju({ctx:e}){let t=uo.state.focusedStoredSessionId,o=uo.state.focusedSessionProfile,a=uo.state.focusedSessionOwner,s=uo.state.connectionId,l=t?na(t):null,c=o?na(o):"default",p=a?na(a):null,d=s?na(s):null,m=ig(tn,Ke,Ke),[w,f]=kt(!1),[h,$]=kt(null),[v,x]=kt(null),[b,C]=kt("add"),[_,O]=kt(""),[Z,ce]=kt(2),[te,E]=kt(!1),[K,J]=kt(!1),[B,j]=kt(!1),[z,ne]=kt(!0),[Ae,je]=kt(""),[Se,me]=kt(!1),Y=Lu(async P=>{if(l)try{let U=await ea(e,l,c,p,d);if(U.kind==="not_found"){x(U.error),$(null);return}x(null),$(U.data)}catch{x(null),$(null),P?.notifyError&&de(n.loadError)}},[e,l,c,p,d]);Wo(()=>{l&&Y()},[l,c,p,Y]),Wo(()=>{if(!l)return;let P=()=>{Y()},U=[];return e.onEvent?U.push(e.onEvent(Ou,P)):uo.onEvent&&U.push(uo.onEvent(Ou,P)),()=>{for(let fe of U)fe()}},[e,l,Y]),Wo(()=>{!w||!l||(Y({notifyError:!0}),(async()=>{try{let P=await $n(e);j(P.settings.name_after_chat),ne(Yr(P.settings)!=="none")}catch{de(n.loadError)}})())},[w,l,e,Y]),Wo(()=>{w&&(h?.tracked?(C("tracked"),ce(cs(h.tasks,h.group))):(C("add"),ce(2),O("")))},[w,h?.tracked,h?.chat_key]);let he=Lu(()=>{if(!h||h.tasks.length===0)return"";let P=Fo(h.tasks,h.chat_key);return P.kind==="task"?An(h.tasks.find(U=>U.id===P.taskId)??h.tasks[0],B):h.group?no(h.group,B):An(h.tasks[0],B)},[h,B]);Wo(()=>{!w||b!=="tracked"||!h||je(he())},[w,b,h,he,B]);let q=async()=>{if(!h||b!=="tracked")return;let P=Ae.trim(),U=he().trim();if(P===U)return;let fe=Fo(h.tasks,h.chat_key);me(!0);try{fe.kind==="task"?await zt(e,fe.taskId,{title:P||null}):await jt(e,fe.chatKey,{title:P||null}),Bo(),await Y()}catch{de(n.patchError),je(he())}finally{me(!1)}};if(!t||!l||!m)return null;let S=h?.tracked??!1,H=h?.tasks.length??0,we=S&&H>0,xe=we?n.composerButtonTracked(H):n.composerButton,ve=async P=>{if(!h)return;let U=Fo(h.tasks,h.chat_key);J(!0);try{U.kind==="task"?await zt(e,U.taskId,P):await jt(e,U.chatKey,P),Bo(),await Y()}catch(fe){mn(fe)?(lo()&&ie(n.notOnThisProfile),f(!1)):de(n.patchError)}finally{J(!1)}},Re=async P=>{ce(P),b==="tracked"&&h&&await ve({quadrant:P})},Ie=async()=>{if(l){E(!0);try{await Nu(e,l,c,p,d,{ask:_.trim()||void 0,quadrant:Z}),ie(n.composerAdded),f(!1),O(""),await Y()}catch(P){let U=De(P);mn(P)?(lo()&&ie(n.notOnThisProfile),f(!1)):U.status===404?(x(U.error),C("add")):de(n.patchError)}finally{E(!1)}}},oe=async()=>{if(!h)return;E(!0);let P=Fo(h.tasks,h.chat_key);try{let U=!1;P.kind==="task"?await zt(e,P.taskId,{status:"done"}):U=!!(await jt(e,P.chatKey,{status:"done",task_ids:Tl(h.tasks)})).already_closed,Bo(),ie(U?n.alreadyCleared:n.composerCompleted),f(!1),await Y()}catch(U){mn(U)?(lo()&&ie(n.notOnThisProfile),f(!1)):io(U)?(ie(n.alreadyCleared),f(!1),Bo(),await Y()):de(n.patchError)}finally{E(!1)}},_e=v!=null?!1:!S||b==="add",le=v?n.composerButton:_e?n.composerAddTitle:n.composerTrackedTitle;return Ze(Ps,{children:[pe("style",{children:_u}),Ze("button",{type:"button",className:`${r} wou-icon-btn wou-composer-trigger`,"aria-label":xe,title:xe,onClick:()=>f(!0),children:[pe(Zr,{}),we?pe("span",{className:"wou-composer-badge","aria-hidden":"true"}):null]}),pe(og,{open:w,onOpenChange:f,children:Ze(rg,{className:`${r} wou-dialog`,children:[pe("style",{children:Rn}),Ze(ag,{children:[pe(sg,{children:le}),v?pe(Mu,{className:"wou-composer-error",children:v}):_e?pe(Mu,{children:n.composerAddDescription}):null]}),pe("div",{className:"wou-composer-body",children:v?null:_e?Ze(Ps,{children:[Ze("label",{className:"wou-field",children:[pe("span",{className:"wou-field-label",children:n.composerAskLabel}),pe("textarea",{rows:3,value:_,maxLength:300,placeholder:n.composerAskPlaceholder,onChange:P=>O(P.target.value),disabled:te})]}),z?Ze("div",{className:"wou-field",children:[pe("span",{className:"wou-field-label",children:n.composerQuadrantLabel}),pe(Fu,{value:Z,disabled:te,onChange:ce})]}):null]}):h?Ze(Ps,{children:[Ze("label",{className:"wou-field",children:[pe("span",{className:"wou-field-label",children:n.renameLabel}),pe("input",{type:"text",value:Ae,maxLength:120,disabled:Se||K||te,onChange:P=>je(P.target.value),onBlur:()=>{q()},onKeyDown:P=>{P.key==="Enter"&&(P.preventDefault(),q())}}),Se?pe("span",{className:"wou-muted",role:"status",children:n.scanning}):null]}),pe("ul",{className:"wou-composer-task-list",children:h.tasks.map(P=>Ze("li",{className:"wou-composer-task-item",children:[pe("p",{className:"wou-composer-task-primary",children:cg(P,B)}),Ze("p",{className:"wou-composer-task-meta",children:[P.project?pe("span",{children:P.project.name}):null,pe("span",{children:Hr(P.quadrant)}),P.status==="snoozed"?pe("span",{className:"wou-composer-tag",children:n.composerSnoozed}):null]})]},P.id))}),z?Ze("div",{className:"wou-field",children:[pe("span",{className:"wou-field-label",children:n.composerQuadrantLabel}),pe(Fu,{value:Z,disabled:K||te,onChange:P=>{Re(P)}})]}):null,pe("button",{type:"button",className:"wou-link",onClick:()=>{C("add"),ce(cs(h.tasks,h.group)),O("")},children:n.composerAddAnother})]}):null}),v?pe(Ns,{className:"wou-composer-error-footer",children:pe(Go,{type:"button",variant:"secondary",onClick:()=>f(!1),children:n.composerClose})}):_e?Ze(Ns,{className:"wou-composer-footer",children:[pe(Go,{type:"button",variant:"secondary",disabled:te,onClick:()=>f(!1),children:n.composerCancel}),pe(Go,{type:"button",disabled:te,onClick:()=>{Ie()},children:n.composerAdd})]}):Ze(Ns,{className:"wou-composer-footer",children:[pe(Go,{type:"button",variant:"secondary",disabled:te||K,onClick:()=>f(!1),children:n.composerCancel}),pe(Go,{type:"button",disabled:te||K,onClick:()=>{oe()},children:n.composerMarkComplete})]})]})})]})}import{host as Qe,useValue as Js}from"@hermes/plugin-sdk";import{useCallback as W,useEffect as Ee,useLayoutEffect as Zd,useMemo as Fe,useRef as Me,useState as Q,useSyncExternalStore as Qm}from"react";import{useState as bg}from"react";import{useCallback as Hu,useEffect as dg,useRef as pg,useState as co}from"react";function zu(e,t,o,a,s,l,c){if(l!==c)return e;let p={...e};for(let d of["model","base_url","cloudflare_account_id"])e[d]===t[d]&&(t[d]===o[d]||d in a)&&(p[d]=s[d]);return p}import{Fragment as Bu,jsx as Je,jsxs as Ht}from"react/jsx-runtime";function oa({ctx:e,compact:t}){let[o,a]=co(null),[s,l]=co(null),[c,p]=co(null),[d,m]=co({model:"",base_url:"",cloudflare_account_id:""}),w=pg(0),[f,h]=co(!1),[$,v]=co(null),x=Hu(E=>{a(E),m({model:E.model,base_url:E.base_url,cloudflare_account_id:E.cloudflare_account_id})},[]),b=Hu(async()=>{try{x(await cu(e)),l(null)}catch(E){l(De(E).error||n.decisionLoadError)}},[e,x]);dg(()=>{b()},[b]);let C=async E=>{let K=++w.current,J={...d},B=o?{model:o.model,base_url:o.base_url,cloudflare_account_id:o.cloudflare_account_id}:J;p(null),v(null);try{let j=await du(e,E);if(K!==w.current)return;a(j),m(z=>zu(z,J,B,E,j,K,w.current))}catch(j){K===w.current&&p(De(j).error||n.decisionSaveError)}};if(!o)return s?Ht("p",{className:"wou-muted",role:"alert",children:[s," ",Je("button",{type:"button",className:"wou-link",onClick:()=>{b()},children:n.retry})]}):Je("p",{className:"wou-muted",role:"status",children:n.settingsLoading});let _=o.providers.find(E=>E.id===o.provider)??null,O=E=>{if(E===o.provider)return;let K=o.providers.find(J=>J.id===E);C(K?{provider:E,model:K.default_model}:{provider:""})},Z=E=>{let K=d[E].trim();K!==o[E]&&C({[E]:K})},ce=(E,K,J)=>Ht("label",{className:"wou-field",children:[Je("span",{className:"wou-field-label",children:K}),Je("input",{type:"text",value:d[E],placeholder:J,spellCheck:!1,autoComplete:"off",onChange:B=>m(j=>({...j,[E]:B.target.value})),onBlur:()=>Z(E),onKeyDown:B=>{B.key==="Enter"&&(B.preventDefault(),B.currentTarget.blur())}})]}),te=async()=>{h(!0),v(null);try{let E=await pu(e);v({ok:E.ok,text:Ul(E)})}catch(E){v({ok:!1,text:De(E).error||n.decisionTestFailedPlain})}finally{h(!1)}};return Ht("div",{className:"wou-decision",children:[o.native_available?Je("p",{className:"wou-decision-native",children:n.decisionNative}):null,Ht("label",{className:"wou-field",children:[Je("span",{className:"wou-field-label",children:n.decisionProvider}),Ht("select",{value:o.provider,onChange:E=>O(E.target.value),children:[Je("option",{value:"",children:n.decisionProviderOff}),o.providers.map(E=>Je("option",{value:E.id,children:E.label},E.id))]}),_?.note?Je("span",{className:"wou-muted",children:_.note}):null]}),_?Ht(Bu,{children:[ce("model",n.decisionModel,_.default_model),_.needs_base_url?ce("base_url",n.decisionBaseUrl,"https://"):null,_.needs_account_id?ce("cloudflare_account_id",n.decisionAccountId):null,_.needs_key?Ht("p",{className:"wou-decision-key",children:[Je("span",{className:o.key_set?"wou-decision-key-ok":"wou-decision-key-missing",children:o.key_set?n.decisionKeySaved:n.decisionKeyNotSet}),o.key_set?null:Ht("span",{className:"wou-muted",children:[" ",n.decisionKeyWhere(n.decisionKeyPath,o.key_name)]})]}):null]}):null,c?Je("p",{className:"wou-field-error",role:"alert",children:c}):null,_||o.native_available?Ht("div",{className:"wou-decision-test",children:[Je("button",{type:"button",className:"wou-btn-compact",onClick:()=>{te()},disabled:f,"aria-busy":f,children:f?n.decisionTesting:n.decisionTest}),$?Je("span",{className:$.ok?"wou-decision-test-ok":"wou-decision-test-fail",role:"status",children:$.text}):null]}):null,t?null:Ht(Bu,{children:[Je("p",{className:"wou-muted wou-decision-usage",children:n.decisionUsageToday(o.usage_today.calls,o.usage_today.input_tokens)}),o.last_error?Je("p",{className:"wou-muted wou-decision-usage",children:n.decisionLastError(o.last_error)}):null]})]})}import{useState as As}from"react";import{Fragment as wg,jsx as nn,jsxs as Ko}from"react/jsx-runtime";var gg=3;function _t(e){return`wou-tc-${Lo(e)}`}function mg(e){return e?zr.includes(e)?{className:_t(e)}:/^#[0-9a-f]{3,8}$/i.test(e)?{className:"",style:{"--wou-tag-hue":e}}:{className:""}:{className:""}}function fg({tag:e}){let t=e.source==="auto";return Ko("span",{className:`wou-tag-chip ${_t(e.color)}`,title:t?`${e.name} \xB7 ${n.tagAddedByAi}`:e.name,children:[t?nn("span",{"aria-label":n.tagAddedByAi,role:"img",style:{display:"inline-flex"},children:nn(gn,{})}):null,nn("span",{className:"wou-tag-chip-name",children:e.name})]})}function Qo({tags:e}){if(e.length===0)return null;let{shown:t,extra:o}=rl(e,gg),a=e.slice(t.length).map(s=>s.name).join(", ");return Ko(wg,{children:[t.map(s=>nn(fg,{tag:s},s.id)),o>0?Ko("span",{className:"wou-tag-chip wou-tag-chip-more",title:n.tagMoreTitle(a),children:["+",o]}):null]})}function ra({project:e,onClick:t}){let o=mg(e.color),a=e.color&&(o.className||o.style)?nn("span",{className:`wou-project-dot ${o.className}`,style:o.style,"aria-hidden":"true"}):null;return t?Ko("button",{type:"button",className:"wou-badge wou-project-chip",title:n.projectBadgeTip(e.name),onClick:()=>t(e),children:[a,nn("span",{className:"wou-tag-chip-name",children:e.name})]}):Ko("span",{className:"wou-badge wou-project-chip",children:[a,e.name]})}function Dn({dueAt:e,now:t}){if(e==null)return null;let o=Il(e,t);if(!o)return null;let a=new Date(e*1e3).toLocaleString(void 0,{dateStyle:"full",timeStyle:"short"});return nn("span",{className:`wou-due-chip wou-due-${o.tone}`,title:a,children:o.label})}function aa({value:e,onChange:t,disabled:o,label:a}){let s=Lo(e);return nn("div",{className:"wou-swatches",role:"radiogroup","aria-label":a,children:zr.map(l=>nn("button",{type:"button",role:"radio","aria-checked":s===l,"aria-label":n.tagColorName(l),title:n.tagColorName(l),className:`wou-swatch ${_t(l)}`,disabled:o,onClick:()=>t(l)},l))})}import{Fragment as hg,jsx as xt,jsxs as po}from"react/jsx-runtime";function sa({ctx:e,tags:t,onAddTag:o}){let[a,s]=As(null),[l,c]=As(!1),[p,d]=As(null),m=t.map(x=>x.name),w=async()=>{c(!0),d(null);try{let x=await gu(e);s(Wl(x,m))}catch(x){d(De(x).error||n.tagSuggestError)}finally{c(!1)}},f=async x=>{let b=ys(x.name);if(b){s(C=>C&&_n(C,x.key,"pending",b));return}if(ql(x,m)){s(C=>C&&_n(C,x.key,"pending",n.tagSuggestTaken));return}s(C=>C&&_n(C,x.key,"adding"));try{await o({name:x.name.trim(),color:x.color,hint:x.hint}),s(C=>C&&_n(C,x.key,"added"))}catch(C){s(_=>_&&_n(_,x.key,"pending",De(C).error||n.tagSaveError))}},h=async()=>{if(a)for(let x of Ql(a,m))await f(x)},$=a?.filter(x=>x.status!=="skipped")??[],v=a?Vl(a):0;return po("div",{className:"wou-suggest",children:[po("div",{className:"wou-suggest-head",children:[xt("button",{type:"button",className:"wou-btn-compact",onClick:()=>{w()},disabled:l,"aria-busy":l,children:l?n.tagSuggesting:n.tagSuggest}),a&&v>1?xt("button",{type:"button",className:"wou-btn-compact",onClick:()=>{h()},children:n.tagSuggestAddAll}):null]}),xt("p",{className:"wou-muted wou-suggest-note",children:n.tagSuggestNote}),p?xt("p",{className:"wou-suggest-error",role:"alert",children:p}):null,a&&$.length===0&&!l?xt("p",{className:"wou-muted wou-settings-empty",children:n.tagSuggestEmpty}):null,$.length>0?xt("ul",{className:"wou-suggest-list",children:$.map(x=>{let b=x.status==="added",C=x.status==="adding";return po("li",{className:"wou-suggest-item",children:[po("div",{className:"wou-suggest-main",children:[xt("span",{className:`wou-tag-swatch-btn ${_t(x.color)}`,"aria-hidden":"true"}),xt("input",{type:"text",className:"wou-tag-name-input",value:x.name,maxLength:32,disabled:b||C,"aria-label":n.tagSuggestRename(x.name),onChange:_=>s(O=>O&&Kl(O,x.key,_.target.value)),onKeyDown:_=>{_.key==="Enter"&&(_.preventDefault(),f(x))}}),b?xt("span",{className:"wou-muted wou-suggest-added",children:n.tagSuggestAdded}):po(hg,{children:[xt("button",{type:"button",className:"wou-btn-compact",disabled:C,onClick:()=>{f(x)},children:n.tagSuggestAdd}),xt("button",{type:"button",className:"wou-link wou-link-compact",disabled:C,onClick:()=>s(_=>_&&_n(_,x.key,"skipped")),children:n.tagSuggestSkip})]})]}),x.hint||x.example_count>0?po("p",{className:"wou-muted wou-suggest-hint",children:[x.hint,x.hint&&x.example_count>0?" \xB7 ":"",x.example_count>0?n.tagSuggestExamples(x.example_count):""]}):null,x.error?xt("p",{className:"wou-field-error",role:"alert",children:x.error}):null]},x.key)})}):null]})}function Uu(e){return e.get("teach-card",!1)===!0}function ia(e,t,o=0){return t==="session"&&!(o>0)?!1:(e.set("teach-card",!0),!0)}function Gu(e){return e.desktop&&e.consented&&e.scanned&&e.availability==="ready"&&!e.resolved&&!e.onboarding&&!e.settings&&!e.teaching&&!e.searching&&!e.closed}function Wu(e,t){return e||t==="checking"?"waiting":t==="ready"?"ready":"empty"}import{Fragment as la,jsx as $e,jsxs as $t}from"react/jsx-runtime";function Ku({settings:e,model:t,scanning:o,onStart:a,onChangeSettings:s}){let l=e.mode,c=wl(e.daily_call_cap),p=pl(l,e.sweep_minutes);return $t("div",{className:"wou-first-run",children:[$e("h2",{className:"wou-first-run-title",children:n.pluginName}),$e("p",{children:n.firstRunLine1}),$e("p",{children:n.firstRunLine2(t.label)}),$e("p",{children:n.firstRunLine3(p,c,e.lookback_days)}),o?$e("p",{className:"wou-muted",role:"status",children:n.scanningHint}):null,$t("div",{className:"wou-first-run-actions",children:[$e("button",{type:"button",onClick:a,disabled:o,"aria-busy":o,children:o?n.scanning:n.firstRunStart}),$e("button",{type:"button",className:"wou-link",onClick:s,disabled:o,children:n.firstRunChangeSettings})]})]})}var _s=["decision","tags","teach"];function Qu({ctx:e,tags:t,scanning:o,teachAvailability:a,onAddTag:s,onTeachNow:l,onFinish:c}){let p=Wu(o,a),[d,m]=bg("decision"),w=_s.indexOf(d),f=()=>{let h=_s[w+1];h?m(h):c()};return $t("div",{className:"wou-first-run wou-first-run-steps",children:[$e("p",{className:"wou-muted wou-first-run-step",children:n.firstRunStepOf(w+1,_s.length)}),d==="decision"?$t(la,{children:[$e("h2",{className:"wou-first-run-title",children:n.firstRunDecisionTitle}),$e("p",{children:n.decisionIntro}),$e(oa,{ctx:e,compact:!0}),$t("div",{className:"wou-first-run-actions wou-first-run-actions-row",children:[$e("button",{type:"button",onClick:f,children:n.firstRunNext}),$e("button",{type:"button",className:"wou-link",onClick:f,children:n.firstRunSkip})]})]}):null,d==="tags"?$t(la,{children:[$e("h2",{className:"wou-first-run-title",children:n.firstRunTagsTitle}),$e("p",{children:n.firstRunTagsIntro}),$e(sa,{ctx:e,tags:t,onAddTag:s}),$t("div",{className:"wou-first-run-actions wou-first-run-actions-row",children:[$e("button",{type:"button",onClick:f,children:n.firstRunNext}),$e("button",{type:"button",className:"wou-link",onClick:f,children:n.firstRunSkip})]})]}):null,d==="teach"?$t(la,{children:[$e("h2",{className:"wou-first-run-title",children:n.firstRunTeachTitle}),$e("p",{children:n.firstRunTeachIntro}),p==="waiting"?$t("p",{className:"wou-muted wou-teach-wait",role:"status",children:[$e(Xr,{className:"wou-icon-spin"}),o?n.firstRunTeachWait:n.teachLoading]}):null,p==="empty"?$t(la,{children:[$e("p",{className:"wou-muted",children:n.firstRunTeachEmpty}),$e("button",{type:"button",onClick:c,children:n.firstRunFinish})]}):$t("div",{className:"wou-first-run-actions wou-first-run-actions-row",children:[$e("button",{type:"button",onClick:l,disabled:p!=="ready",children:n.firstRunTeachNow}),$e("button",{type:"button",className:"wou-link",onClick:c,children:n.firstRunLater})]})]}):null]})}import{useCallback as Es,useEffect as qo,useRef as Mn,useState as Ut}from"react";import{Button as qu,Dialog as yg,DialogContent as kg,DialogDescription as xg,DialogFooter as vg,DialogHeader as Tg,DialogTitle as Sg}from"@hermes/plugin-sdk";import{useEffect as Cg,useState as ua}from"react";import{jsx as Et,jsxs as go}from"react/jsx-runtime";function Ng(e){let t=e.trim();if(!t)return t;let o=t.charAt(0).toUpperCase()+t.slice(1);return/[.!?]$/.test(o)?o:`${o}.`}function mo({open:e,onOpenChange:t,createTag:o,onCreated:a,applies:s}){let[l,c]=ua(""),[p,d]=ua("gray"),[m,w]=ua(!1),[f,h]=ua(null);Cg(()=>{e&&(c(""),d("gray"),h(null),w(!1))},[e]);let $=async()=>{let v=l.trim();if(!m){if(v.length<1||v.length>32){h(n.tagNameInvalid);return}w(!0),h(null);try{let x=await o(v,p);if(!x){h(n.tagSaveError);return}a?.(x),t(!1)}catch(x){let b=De(x).error;h(b?Ng(b):n.tagSaveError)}finally{w(!1)}}};return Et(yg,{open:e,onOpenChange:t,children:go(kg,{className:`${r} wou-dialog`,children:[Et("style",{children:Rn}),go(Tg,{children:[Et(Sg,{children:n.tagNewTitle}),Et(xg,{children:s?n.tagNewDescriptionApply:n.tagNewDescription})]}),go("div",{className:"wou-composer-body",children:[go("label",{className:"wou-field",children:[Et("span",{className:"wou-field-label",children:n.tagName}),Et("input",{type:"text",value:l,maxLength:32,autoFocus:!0,disabled:m,placeholder:n.tagNamePlaceholder,onChange:v=>{c(v.target.value),h(null)},onKeyDown:v=>{v.key==="Enter"&&(v.preventDefault(),$())}})]}),go("div",{className:"wou-field",children:[Et("span",{className:"wou-field-label",children:n.tagColor}),Et(aa,{value:p,onChange:d,disabled:m,label:n.tagColor})]}),f?Et("p",{className:"wou-snooze-error",role:"alert",children:f}):null]}),go(vg,{className:"wou-composer-footer",children:[Et(qu,{type:"button",variant:"secondary",disabled:m,onClick:()=>t(!1),children:n.snoozeCancel}),Et(qu,{type:"button",disabled:m||!l.trim(),onClick:()=>{$()},children:n.tagCreate})]})]})})}function Vu(e){let t=Promise.resolve(),o={},a=new Map,s=0,l=c=>({...c,...o});return{merge:l,edit(c){o={...o,...c};for(let p of Object.keys(c))a.set(p,++s)},save(c){let p={...c},d=new Map(a),m=t.then(async()=>{let w=await e(p);for(let f of Object.keys(p))a.get(f)===d.get(f)&&delete o[f];return l(w)});return t=m.then(()=>{},()=>{}),m}}}import{jsx as ca,jsxs as Yu}from"react/jsx-runtime";function fn({checked:e,onChange:t,label:o,description:a,id:s}){return Yu("div",{className:"wou-settings-toggle-row",children:[ca("button",{type:"button",id:s,role:"switch","aria-checked":e,"aria-labelledby":`${s}-label`,className:`wou-switch${e?" wou-switch-on":""}`,onClick:()=>t(!e),children:ca("span",{className:"wou-switch-knob","aria-hidden":"true"})}),Yu("button",{type:"button",className:"wou-settings-toggle-label",onClick:()=>t(!e),children:[ca("span",{id:`${s}-label`,className:"wou-settings-row-label",children:o}),a?ca("span",{className:"wou-muted wou-settings-row-desc",children:a}):null]})]})}import{useCallback as $g,useEffect as Eg,useState as st}from"react";var Pg=900,Xu=1440*60;function $s(e){return(e.agent_name||"").trim()||e.name}function Zu(e,t){if(e.last_seen==null||!Number.isFinite(e.last_seen))return{text:n.satellitesStatusWaiting,warn:!1};let o=Math.max(0,t-e.last_seen);if(o<Pg){let l;if(o<60)l=n.satellitesStatusUpdatedJustNow;else{let c=Math.floor(o/60);l=n.satellitesStatusUpdatedMin(c)}return{text:n.satellitesStatusSending(l),warn:!1}}if(o<Xu){let l=Math.floor(o/3600),c=l<1?1:l;return{text:n.satellitesStatusLastHours(c),warn:!1}}let a=Math.floor(o/Xu),s=a<1?1:a;return{text:n.satellitesStatusLastDays(s),warn:!0}}function Ag(e){let t=e.split(".");if(t.length!==4)return null;let o=[];for(let a of t){if(!/^\d{1,3}$/.test(a))return null;let s=Number(a);if(s>255)return null;o.push(s)}return o}function _g(e){let t=e.trim().toLowerCase();if(!t)return!1;if(t==="localhost"||t.endsWith(".local"))return!0;let o=Ag(t);if(o){let[a,s]=o;return a===127||a===10||a===172&&s>=16&&s<=31||a===192&&s===168||a===169&&s===254||a===100&&s>=64&&s<=127}return!!(t==="::1"||t.startsWith("fc")||t.startsWith("fd")||t.startsWith("fe80"))}function Ju(e){let t=e.trim();if(!/^http:\/\//i.test(t))return!1;try{let o=new URL(t).hostname;return o?!_g(o):!0}catch{return!1}}var ec=/^[a-z0-9][a-z0-9_-]{0,31}$/;import{Fragment as Og,jsx as ae,jsxs as Bt}from"react/jsx-runtime";var tc="wou.hubAddress",Rg=6e4;function Ig(){try{return localStorage.getItem(tc)??""}catch{return""}}function Dg(e){try{localStorage.setItem(tc,e)}catch{}}function Mg(e,t){return`hermes waiting-on-you-satellite pair ${e.trim()} ${t}`}function Lg(e){let t=e&&typeof e=="object"&&"message"in e?String(e.message):"",o=t.toLowerCase();return o.includes("invalid satellite name")||o.includes("name already in use")?n.satellitesPairErrorName:o.includes("too many active pairing codes")?n.satellitesPairErrorTooMany:t||n.satellitesPairErrorGeneric}function nc({ctx:e}){let[t,o]=st(null),[a,s]=st([]),[l,c]=st(null),[p,d]=st(!1),[m,w]=st(""),[f,h]=st(""),[$,v]=st(""),[x,b]=st(()=>Ig()),[C,_]=st(null),[O,Z]=st(null),[ce,te]=st(null),[E,K]=st(null),[J,B]=st(!1),[j,z]=st(()=>Math.floor(Date.now()/1e3)),ne=$g(async()=>{try{let[S,H]=await Promise.all([ou(e),ru(e)]);o(S),s(H.filter(we=>we.revoked_at==null)),c(null)}catch{c(n.satellitesLoadError)}},[e]);Eg(()=>{ne();let S=setInterval(()=>{ne()},Rg),H=setInterval(()=>z(Math.floor(Date.now()/1e3)),3e4);return()=>{clearInterval(S),clearInterval(H)}},[ne]);let Ae=t?.enabled??!1,je=Ju(x),Se=()=>{d(!0),K(null),te(null),_(null),Z(null)},me=()=>{d(!1),K(null),te(null),_(null),Z(null)},Y=async()=>{let S=m.trim().toLowerCase(),H=x.trim(),we=!0;if(ec.test(S)?_(null):(_(n.satellitesNameInvalid),we=!1),H?Z(null):(Z(n.satellitesHubRequired),we=!1),!!we){Dg(H),B(!0),te(null);try{let xe={name:S},ve=f.trim();ve&&(xe.agent_name=ve);let Re=$.trim();Re&&(xe.connections=[Re]);let Ie=await au(e,xe);K({command:Mg(H,Ie.code)}),await ne()}catch(xe){te(Lg(xe))}finally{B(!1)}}},he=async S=>{let H=$s(S);if(window.confirm(n.satellitesRemoveConfirm(H)))try{await su(e,S.id),await ne()}catch{c(n.satellitesRevokeError)}},q=async S=>{try{!await e.os.writeClipboard(S)&&navigator.clipboard?.writeText&&await navigator.clipboard.writeText(S)}catch{try{await navigator.clipboard?.writeText(S)}catch{}}};return Bt("section",{className:"wou-settings-card","aria-labelledby":"wou-set-satellites",children:[ae("h3",{id:"wou-set-satellites",children:n.settingsSatellitesSection}),ae("p",{className:"wou-muted wou-satellites-intro",children:n.satellitesIntro}),t&&!Ae?ae("p",{className:"wou-muted wou-satellites-warn-line",role:"status",children:n.satellitesDisabled(t.reason)}):null,l?ae("p",{className:"wou-field-error",role:"alert",children:l}):null,a.length===0?ae("p",{className:"wou-muted wou-settings-empty",children:n.satellitesEmpty}):ae("ul",{className:"wou-satellite-list",children:a.map(S=>{let H=Zu(S,j);return Bt("li",{className:"wou-satellite-list-item",children:[ae("span",{className:"wou-satellite-list-name",children:$s(S)}),ae("span",{className:`wou-muted wou-satellite-list-status${H.warn?" wou-satellite-status-warn":""}`,children:H.text}),ae("button",{type:"button",className:"wou-link wou-link-compact",onClick:()=>{he(S)},children:n.satellitesRemove})]},S.id)})}),Ae&&!p&&!E?ae("button",{type:"button",className:"wou-btn-compact",onClick:Se,children:n.satellitesAdd}):null,Ae&&p?ae("div",{className:"wou-satellite-form",children:E?Bt("div",{className:"wou-satellite-pair-result",children:[ae("pre",{className:"wou-satellite-command",children:E.command}),ae("button",{type:"button",className:"wou-btn-compact",onClick:()=>{q(E.command)},children:n.satellitesCopyCommand}),ae("p",{className:"wou-muted",children:n.satellitesCodeExpiry}),Bt("ol",{className:"wou-satellite-steps",children:[ae("li",{children:n.satellitesPairStep1}),ae("li",{children:ae("code",{children:"hermes plugins enable waiting-on-you-satellite"})}),ae("li",{children:n.satellitesPairStep3}),ae("li",{children:n.satellitesPairStep4})]}),ae("button",{type:"button",className:"wou-link",onClick:me,children:n.satellitesCancel})]}):Bt(Og,{children:[Bt("label",{className:"wou-field",children:[ae("span",{className:"wou-field-label",children:n.satellitesName}),ae("input",{type:"text",value:m,onChange:S=>w(S.target.value),autoComplete:"off",spellCheck:!1,"aria-invalid":!!C}),ae("span",{className:"wou-muted",children:n.satellitesNameHint}),C?ae("span",{className:"wou-field-error",role:"alert",children:C}):null]}),Bt("label",{className:"wou-field",children:[ae("span",{className:"wou-field-label",children:n.satellitesAgentName}),ae("input",{type:"text",value:f,onChange:S=>h(S.target.value),autoComplete:"off"}),ae("span",{className:"wou-muted",children:n.satellitesAgentHint})]}),Bt("label",{className:"wou-field",children:[ae("span",{className:"wou-field-label",children:n.satellitesConnection}),ae("input",{type:"text",value:$,onChange:S=>v(S.target.value),autoComplete:"off"}),ae("span",{className:"wou-muted",children:n.satellitesConnectionHint})]}),Bt("label",{className:"wou-field",children:[ae("span",{className:"wou-field-label",children:n.satellitesHubAddress}),ae("input",{type:"text",value:x,onChange:S=>b(S.target.value),autoComplete:"off",spellCheck:!1,"aria-invalid":!!O}),ae("span",{className:"wou-muted",children:n.satellitesHubAddressHint}),je?ae("span",{className:"wou-satellite-status-warn",role:"status",children:n.satellitesHttpPublicWarning}):null,O?ae("span",{className:"wou-field-error",role:"alert",children:O}):null]}),ce?ae("p",{className:"wou-field-error",role:"alert",children:ce}):null,Bt("div",{className:"wou-satellite-form-actions",children:[ae("button",{type:"button",className:"wou-btn-compact",disabled:J,onClick:()=>{Y()},children:n.satellitesCreateCode}),ae("button",{type:"button",className:"wou-link",onClick:me,children:n.satellitesCancel})]})]})}):null]})}import{jsx as N,jsxs as ge}from"react/jsx-runtime";var Fg=500,oc="settingsAdvancedOpen",jg=[{value:"priority",label:n.groupByPriority},{value:"project",label:n.groupByProject},{value:"none",label:n.groupByNone}],zg=[{value:"cards",label:n.layoutCards},{value:"compact",label:n.layoutCompact},{value:"focus",label:n.layoutFocus}];function Hg({tag:e,onPatch:t,onDelete:o}){let[a,s]=Ut(e.name),[l,c]=Ut(e.hint??""),[p,d]=Ut(!1);qo(()=>s(e.name),[e.name]),qo(()=>c(e.hint??""),[e.hint]);let m=async()=>{let f=a.trim();if(f===e.name){s(e.name);return}if(f.length<1||f.length>32){de(n.tagNameInvalid),s(e.name);return}await t(e.id,{name:f})||s(e.name)},w=async()=>{let f=l.trim();f!==(e.hint??"").trim()&&(await t(e.id,{hint:f})||c(e.hint??""))};return ge("li",{className:"wou-tag-list-item",children:[ge("div",{className:"wou-tag-list-main",children:[N("button",{type:"button",className:`wou-tag-swatch-btn ${_t(e.color)}`,"aria-label":n.tagChangeColor(e.name),title:n.tagChangeColor(e.name),"aria-expanded":p,onClick:()=>d(f=>!f)}),N("input",{type:"text",className:"wou-tag-name-input",value:a,maxLength:32,"aria-label":n.tagRename(e.name),onChange:f=>s(f.target.value),onBlur:()=>{m()},onKeyDown:f=>{f.key==="Enter"&&(f.preventDefault(),f.currentTarget.blur()),f.key==="Escape"&&(s(e.name),f.currentTarget.blur())}}),N("span",{className:"wou-muted wou-tag-open-count",children:n.tagOpenCount(e.open_count??0)}),N("button",{type:"button",className:"wou-link wou-link-compact",onClick:()=>o(e),children:n.tagDelete})]}),p?N(aa,{value:e.color,label:n.tagColor,onChange:f=>{d(!1),f!==e.color&&t(e.id,{color:f})}}):null,ge("label",{className:"wou-tag-hint-row",children:[N("span",{className:"wou-muted wou-tag-hint-label",children:n.tagHintLabel}),N("input",{type:"text",value:l,maxLength:200,placeholder:n.tagHintPlaceholder,onChange:f=>c(f.target.value),onBlur:()=>{w()},onKeyDown:f=>{f.key==="Enter"&&(f.preventDefault(),f.currentTarget.blur())}})]})]})}var Bg=[{mode:"auto",title:n.settingsModeAutoTitle,description:e=>n.settingsModeAutoDesc(e)},{mode:"hourly",title:n.settingsModeHourlyTitle,description:()=>n.settingsModeHourlyDesc},{mode:"manual",title:n.settingsModeManualTitle,description:()=>n.settingsModeManualDesc},{mode:"off",title:n.settingsModeOffTitle,description:()=>n.settingsModeOffDesc}];function Ug(e,t){return e.includes(t)?e:null}function rc({ctx:e,bundle:t,tags:o,onCreateTag:a,onPatchTag:s,onDeleteTag:l,onAddSuggestedTag:c,onBundleChange:p,onOpenTeach:d,onBack:m}){let[w,f]=Ut(!1),[h,$]=Ut(t.settings),[v,x]=Ut({}),[b,C]=Ut(()=>e.storage.get(oc,!1)),_=Mn(null),O=Mn({}),Z=Mn(e),ce=Mn(t),te=Mn(p);Z.current=e,ce.current=t,te.current=p;let[E]=Ut(()=>Vu(async y=>(await En(Z.current,y)).settings));qo(()=>{$(E.merge(t.settings))},[t.settings,E]);let K=Es(async()=>{let y={...O.current};if(O.current={},Object.keys(y).length!==0)try{let G=await E.save(y),be=E.merge(G),Oe={...ce.current,settings:be};ce.current=Oe,te.current(Oe),$(be),x(Ce=>{let tt={...Ce};for(let pt of Object.keys(y))delete tt[pt];return tt})}catch(G){let be=G?.message??n.patchError,Oe={};for(let Ce of Object.keys(y)){let tt=Ug(be,Ce);tt&&(Oe[Ce]=tt)}Object.keys(Oe).length===0?de(be):x(Ce=>({...Ce,...Oe}))}},[E]),J=Mn(K);J.current=K;let B=Es(y=>{E.edit(y),O.current={...O.current,...y},_.current&&clearTimeout(_.current),_.current=setTimeout(()=>{_.current=null,J.current()},Fg)},[E]),j=Es(y=>{E.edit(y),O.current={...O.current,...y},_.current&&(clearTimeout(_.current),_.current=null),J.current()},[E]);qo(()=>()=>{_.current&&clearTimeout(_.current),_.current=null,J.current()},[]);let z=()=>{_.current&&clearTimeout(_.current),_.current=null,J.current(),m()},ne=ro(h.group_by,h.show_priorities),Ae=y=>{$(G=>({...G,group_by:y,show_priorities:y!=="none"})),j({group_by:y})},je=Qr(h.layout),Se=y=>{$(G=>({...G,layout:y})),j({layout:y})},me=y=>{$(G=>({...G,mode:y})),x(G=>({...G,mode:void 0})),j({mode:y})},Y=(y,G)=>{$(be=>({...be,[y]:G})),j({[y]:G})},[he,q]=Ut({}),S=(y,G)=>{q(Ce=>({...Ce,[y]:G}));let be=dl(y,G);if(x(Ce=>({...Ce,[y]:be??void 0})),be)return;let Oe=cl(y,Number(G));$(Ce=>({...Ce,[y]:Oe})),B({[y]:Oe})},H=y=>{q(G=>{if(!(y in G))return G;let be={...G};return delete be[y],be}),x(G=>G[y]?{...G,[y]:void 0}:G)},we=y=>he[y]??String(h[y]),xe=h.priorities_note??"",[ve,Re]=Ut(xe),Ie=Mn(!1);qo(()=>{Ie.current||Re(xe)},[xe]);let oe=bs(ve,fs),_e=y=>{Re(y),!bs(y,fs).over&&B({priorities_note:y})},le=()=>{Ie.current=!1,!oe.over&&(ve!==xe||"priorities_note"in O.current)&&($(y=>({...y,priorities_note:ve})),j({priorities_note:ve}))},P=()=>{let y=!b;C(y),e.storage.set(oc,y)},U=t.model,fe=t.usage.today,Te=t.usage.history,I=h.daily_call_cap,ue=fl(fe.calls,I),Le=Math.max(1,...Te.map(y=>y.calls));return ge("div",{className:"wou-settings-view",children:[ge("div",{className:"wou-settings-view-header",children:[N("button",{type:"button",className:"wou-link wou-settings-back",onClick:z,children:n.settingsBack}),N("h2",{className:"wou-settings-view-title",children:n.settings})]}),ge("div",{className:"wou-settings-stack",children:[ge("section",{className:"wou-settings-card","aria-labelledby":"wou-set-titles",children:[N("h3",{id:"wou-set-titles",children:n.settingsTaskTitlesSection}),ge("div",{className:"wou-settings-select-row",children:[ge("div",{className:"wou-settings-select-text",children:[N("span",{id:"wou-set-layout-label",className:"wou-settings-row-label",children:n.layoutLabel}),N("span",{className:"wou-muted wou-settings-row-desc",children:n.layoutHelp})]}),N("div",{className:"wou-segmented",role:"radiogroup","aria-labelledby":"wou-set-layout-label",children:zg.map(y=>N("button",{type:"button",role:"radio","aria-checked":je===y.value,onClick:()=>Se(y.value),children:y.label},y.value))})]}),N(fn,{id:"wou-set-name-after-chat",checked:h.name_after_chat,onChange:y=>Y("name_after_chat",y),label:n.nameAfterChat,description:n.nameAfterChatHelp}),ge("div",{className:"wou-settings-select-row",children:[ge("div",{className:"wou-settings-select-text",children:[N("span",{id:"wou-set-group-by-label",className:"wou-settings-row-label",children:n.groupByLabel}),N("span",{className:"wou-muted wou-settings-row-desc",children:n.groupByHelp})]}),N("div",{className:"wou-segmented",role:"radiogroup","aria-labelledby":"wou-set-group-by-label",children:jg.map(y=>N("button",{type:"button",role:"radio","aria-checked":ne===y.value,onClick:()=>Ae(y.value),children:y.label},y.value))})]}),N(fn,{id:"wou-set-show-project-badges",checked:h.show_project_badges,onChange:y=>Y("show_project_badges",y),label:n.showProjectBadges,description:n.showProjectBadgesHelp}),N(fn,{id:"wou-set-follow-selected-chat",checked:h.follow_selected_chat,onChange:y=>Y("follow_selected_chat",y),label:n.followSelectedChat,description:n.followSelectedChatHelp}),N(fn,{id:"wou-set-archive-chat",checked:h.archive_chat_on_done,onChange:y=>Y("archive_chat_on_done",y),label:n.archiveChatOnDone,description:n.archiveChatHelp})]}),ge("section",{className:"wou-settings-card","aria-labelledby":"wou-set-priorities-note",children:[N("h3",{id:"wou-set-priorities-note",children:n.prioritiesNoteSection}),ge("label",{className:"wou-field",children:[N("span",{className:"wou-muted",children:n.prioritiesNoteHelp}),N("textarea",{value:ve,rows:3,placeholder:n.prioritiesNotePlaceholder,"aria-label":n.prioritiesNoteLabel,"aria-invalid":oe.over,onFocus:()=>{Ie.current=!0},onChange:y=>_e(y.target.value),onBlur:le}),N("span",{className:`wou-char-count${oe.over?" wou-char-count-over":""}`,"aria-live":oe.near?"polite":"off",children:oe.label}),oe.over?N("span",{className:"wou-field-error",role:"alert",children:n.prioritiesNoteTooLong}):null]}),ge("div",{className:"wou-settings-inline-action",children:[N("button",{type:"button",className:"wou-btn-compact",onClick:d,children:n.teachFromSettings}),N("span",{className:"wou-muted wou-settings-row-desc",children:n.teachFromSettingsHelp})]})]}),ge("section",{className:"wou-settings-card","aria-labelledby":"wou-set-decision",children:[N("h3",{id:"wou-set-decision",children:n.decisionSection}),N("p",{className:"wou-muted wou-settings-empty wou-decision-intro",children:n.decisionIntro}),N(oa,{ctx:e}),N(fn,{id:"wou-set-decision-gate",checked:h.decision_gate??!0,onChange:y=>Y("decision_gate",y),label:n.decisionGate,description:n.decisionGateHelp}),N(fn,{id:"wou-set-decision-priority",checked:h.decision_priority??!0,onChange:y=>Y("decision_priority",y),label:n.decisionPriority,description:n.decisionPriorityHelp}),N("p",{className:"wou-muted wou-settings-empty",children:n.decisionNeedsModel})]}),ge("section",{className:"wou-settings-card","aria-labelledby":"wou-set-tags",children:[N("h3",{id:"wou-set-tags",children:n.tagsSection}),N("p",{className:"wou-muted wou-settings-empty",children:n.tagsIntro}),N(fn,{id:"wou-set-auto-tag",checked:h.auto_tag,onChange:y=>Y("auto_tag",y),label:n.autoTag,description:`${n.autoTagHelp} ${n.autoTagDecisionNote}`}),o.length===0?N("p",{className:"wou-muted wou-settings-empty",children:n.tagsEmpty}):N("ul",{className:"wou-tag-list",children:o.map(y=>N(Hg,{tag:y,onPatch:s,onDelete:l},y.id))}),N("button",{type:"button",className:"wou-btn-compact",onClick:()=>f(!0),children:n.tagAdd}),N(mo,{open:w,onOpenChange:f,createTag:a}),N(sa,{ctx:e,tags:o,onAddTag:c})]}),N(nc,{ctx:e}),ge("section",{className:"wou-settings-card","aria-labelledby":"wou-set-shortcuts",children:[N("h3",{id:"wou-set-shortcuts",children:n.settingsShortcutsSection}),N("ul",{className:"wou-shortcuts-list",children:Iu.map(y=>ge("li",{className:"wou-shortcuts-row",children:[N("span",{className:"wou-shortcuts-label",children:y.label}),N("span",{className:"wou-shortcuts-keys",children:y.display.kind==="combo"?Du(y.display.combo).map((G,be)=>N("kbd",{className:"wou-keycap",children:G},`${y.id}-${be}`)):N("span",{className:"wou-shortcuts-hint",children:y.display.text})})]},y.id))}),N("p",{className:"wou-muted wou-shortcuts-footer",children:n.settingsShortcutsFooter})]}),ge("section",{className:"wou-settings-card","aria-labelledby":"wou-set-frequency",children:[N("h3",{id:"wou-set-frequency",children:n.settingsFrequencySection}),N("div",{className:"wou-mode-cards",role:"radiogroup","aria-label":n.settingsFrequencySection,children:Bg.map(y=>{let G=h.mode===y.mode;return ge("button",{type:"button",role:"radio","aria-checked":G,className:`wou-mode-card${G?" wou-mode-card-selected":""}`,onClick:()=>me(y.mode),children:[N("span",{className:"wou-mode-card-title",children:y.title}),N("span",{className:"wou-muted wou-mode-card-desc",children:y.description(h.sweep_minutes)})]},y.mode)})})]}),ge("section",{className:"wou-settings-card","aria-labelledby":"wou-set-usage",children:[N("h3",{id:"wou-set-usage",children:n.settingsUsageSection}),N("p",{className:"wou-settings-usage-line",children:ls(fe.calls,I)}),I>0&&fe.calls>I?N("p",{className:"wou-muted wou-settings-usage-over",children:n.settingsUsageOver(fe.manual_calls??0)}):null,I>0?N("div",{className:"wou-usage-bar",role:"progressbar","aria-valuenow":fe.calls,"aria-valuemin":0,"aria-valuemax":I,"aria-label":ls(fe.calls,I),children:N("div",{className:"wou-usage-bar-fill",style:{width:`${Math.round(ue*100)}%`}})}):null,N("ul",{className:"wou-usage-bars","aria-label":n.settingsUsageHistory,children:Te.map(y=>ge("li",{title:y.date,children:[N("span",{className:"wou-usage-bar-mini","aria-hidden":"true",children:N("span",{className:"wou-usage-bar-mini-fill",style:{height:`${Math.round(y.calls/Le*100)}%`}})}),N("span",{className:"wou-muted wou-usage-bar-day",children:y.date.slice(5)})]},y.date))}),N("p",{className:"wou-muted wou-settings-model-line",children:n.settingsUsageModel(U.label)})]}),ge("section",{className:"wou-settings-card wou-settings-advanced",children:[ge("button",{type:"button",className:"wou-settings-advanced-toggle","aria-expanded":b,onClick:P,children:[N("span",{className:"wou-settings-advanced-chevron","aria-hidden":"true",children:b?"\u25BE":"\u25B8"}),n.settingsAdvanced]}),b?ge("div",{className:"wou-settings-advanced-body",children:[Kr("sweep_minutes",h.mode)?ge("label",{className:"wou-field",children:[N("span",{className:"wou-field-label",children:n.settingsSweep}),N("input",{type:"number",min:15,max:240,value:we("sweep_minutes"),onBlur:()=>H("sweep_minutes"),onChange:y=>S("sweep_minutes",y.target.value),"aria-label":n.settingsSweep,"aria-invalid":!!v.sweep_minutes}),v.sweep_minutes?N("span",{className:"wou-field-error",role:"alert",children:v.sweep_minutes}):null]}):null,Kr("debounce_seconds",h.mode)?ge("label",{className:"wou-field",children:[N("span",{className:"wou-field-label",children:n.settingsDebounce}),N("input",{type:"number",min:30,max:600,value:we("debounce_seconds"),onBlur:()=>H("debounce_seconds"),onChange:y=>S("debounce_seconds",y.target.value),"aria-label":n.settingsDebounce,"aria-invalid":!!v.debounce_seconds}),v.debounce_seconds?N("span",{className:"wou-field-error",role:"alert",children:v.debounce_seconds}):null]}):null,Kr("max_chats_per_scan",h.mode)?ge("label",{className:"wou-field",children:[N("span",{className:"wou-field-label",children:n.settingsMaxChats}),N("input",{type:"number",min:5,max:100,value:we("max_chats_per_scan"),onBlur:()=>H("max_chats_per_scan"),onChange:y=>S("max_chats_per_scan",y.target.value),"aria-label":n.settingsMaxChats,"aria-invalid":!!v.max_chats_per_scan}),v.max_chats_per_scan?N("span",{className:"wou-field-error",role:"alert",children:v.max_chats_per_scan}):null]}):null,ge("label",{className:"wou-field",children:[N("span",{className:"wou-field-label",children:n.settingsDailyCap}),N("input",{type:"number",min:0,max:2e3,value:we("daily_call_cap"),onBlur:()=>H("daily_call_cap"),onChange:y=>S("daily_call_cap",y.target.value),"aria-label":n.settingsDailyCap,"aria-invalid":!!v.daily_call_cap}),N("span",{className:"wou-muted",children:n.settingsDailyCapHint}),v.daily_call_cap?N("span",{className:"wou-field-error",role:"alert",children:v.daily_call_cap}):null]}),ge("label",{className:"wou-field",children:[N("span",{className:"wou-field-label",children:n.settingsLookback}),N("input",{type:"number",min:1,max:30,value:we("lookback_days"),onBlur:()=>H("lookback_days"),onChange:y=>S("lookback_days",y.target.value),"aria-label":n.settingsLookback,"aria-invalid":!!v.lookback_days}),v.lookback_days?N("span",{className:"wou-field-error",role:"alert",children:v.lookback_days}):null]}),ge("label",{className:"wou-field",children:[N("span",{className:"wou-field-label",children:n.settingsRetention}),N("input",{type:"number",min:0,max:365,value:we("retention_days"),onBlur:()=>H("retention_days"),onChange:y=>S("retention_days",y.target.value),"aria-label":n.settingsRetention,"aria-invalid":!!v.retention_days}),N("span",{className:"wou-muted",children:n.settingsRetentionHint}),v.retention_days?N("span",{className:"wou-field-error",role:"alert",children:v.retention_days}):null]}),ge("div",{className:"wou-field",children:[N("span",{className:"wou-field-label",children:n.settingsModel}),N("p",{className:"wou-field-readonly",children:U.label}),N("p",{className:"wou-muted",children:n.settingsModelHint})]})]}):null]})]})]})}import{host as Wg}from"@hermes/plugin-sdk";function Rs(e,t){return t==null||e.some(o=>o.key===t)}function da(e){return!(!e.consented||!e.projectsFetchSucceeded||!e.tasksFetchSucceeded||e.offline||!Rs(e.projects,e.projectKey))}function Is(e,t){let o=e.filter(a=>(a.project?.key??null)===t);return{open:o.filter(a=>a.status==="open"),snoozed:o.filter(a=>a.status==="snoozed").length}}function Ds(e){let t=new Map;for(let o of e){let a=t.get(o.chat_key)??[];a.push(o),t.set(o.chat_key,a)}return[...t].map(([o,a])=>({chatKey:o,tasks:a}))}function ac(e,t){let o=Is(e,t).open;return Ds(o).flatMap(a=>a.tasks.map(s=>s.id))}function Gg(e,t,o){return o==null||!ac(e,t).includes(o)?null:e.find(a=>a.id===o)??null}function sc(e,t){return da(t)?ac(e,t.projectKey):[]}function ic(e,t,o){return da(t)?Gg(e,t.projectKey,o):null}import{Fragment as Kg,jsx as Ge,jsxs as ct}from"react/jsx-runtime";function lc({projects:e,projectKey:t,onProjectChange:o,tasks:a,ready:s,offline:l,consented:c,projectsFetchSucceeded:p,tasksFetchSucceeded:d,projectsError:m,onRetryProjects:w,renderTask:f,onBack:h}){let $=Rs(e,t),x=da({consented:c,projectsFetchSucceeded:p,tasksFetchSucceeded:d,offline:l,projects:e,projectKey:t})?Is(a,t):{open:[],snoozed:0},b=Ds(x.open);return ct("div",{className:"wou-settings-view",children:[ct("div",{className:"wou-settings-view-header",children:[Ge("button",{type:"button",className:"wou-link wou-settings-back",onClick:h,children:"Back"}),Ge("h2",{className:"wou-settings-view-title",children:"Catch up"})]}),ct("label",{className:"wou-field",children:[Ge("span",{children:"Hermes project"}),ct("select",{className:"wou-select",value:t??"",onChange:C=>o(C.target.value||null),children:[Ge("option",{value:"",children:"No project"}),$?null:Ge("option",{value:t,children:"Project unavailable"}),e.map(C=>ct("option",{value:C.key,children:[C.name," \xB7 ",C.profile]},C.key))]})]}),Ge("p",{className:"wou-muted",children:"All agents and tags in this project. Your list filters are unchanged."}),ct("section",{className:"wou-section","aria-labelledby":"wou-cu-chats",children:[ct("h3",{className:"wou-section-heading",id:"wou-cu-chats",children:["Waiting chats",s&&$&&!l?` (${b.length})`:""]}),l?Ge("p",{className:"wou-muted",role:"status",children:"Waiting chats could not be refreshed. Return to the list and retry."}):!s&&m?ct("p",{role:"alert",children:[m," ",Ge("button",{type:"button",className:"wou-link",onClick:w,children:n.retry})]}):s?$?ct(Kg,{children:[b.length===0?Ge("p",{className:"wou-muted",role:"status",children:"No waiting chats in this project. Board cards have not been checked."}):null,b.map(C=>ct("div",{children:[C.tasks.length>1?Ge("h4",{children:C.tasks[0].chat_name||C.tasks[0].chat_title}):null,C.tasks.map(_=>f(_))]},C.chatKey)),x.snoozed>0?ct("p",{className:"wou-muted",children:[x.snoozed," snoozed ",x.snoozed===1?"ask is":"asks are"," hidden."]}):null]}):Ge("p",{className:"wou-muted",role:"status",children:"This project is no longer in the native catalog. Choose another project."}):Ge("p",{className:"wou-muted",role:"status",children:"Loading waiting chats\u2026"})]}),ct("section",{className:"wou-section","aria-labelledby":"wou-cu-human",children:[Ge("h3",{className:"wou-section-heading",id:"wou-cu-human",children:"Human-blocked cards"}),Ge("p",{className:"wou-muted",children:"Board cards are not available through the Hermes public plugin API. Answers, comments, and unblocking must be handled in Kanban."})]}),ct("section",{className:"wou-section","aria-labelledby":"wou-cu-review",children:[Ge("h3",{className:"wou-section-heading",id:"wou-cu-review",children:"Review cards"}),Ge("p",{className:"wou-muted",children:"Review cards have not been checked. Open Kanban to review them."})]}),Ge("button",{type:"button",className:"wou-link",onClick:()=>Wg.navigate("/kanban"),children:"Open Kanban"}),Ge("p",{className:"wou-muted",children:"Opens Kanban only, not a specific board or card."})]})}import{useCallback as uc,useEffect as Ms,useReducer as Qg,useRef as cc}from"react";import{jsx as Ne,jsxs as vt}from"react/jsx-runtime";function qg(e){if(io(e))return!0;let{status:t,error:o}=De(e);return t===404&&/open task not found/i.test(o)}function dc({ctx:e,now:t,scanning:o,onBack:a,onAnswered:s}){let[l,c]=Qg(Ol,ws),p=cc(null),d=cc(0),m=()=>a(d.current),w=Fl(l),f=uc(async()=>{c({type:"load"});try{c({type:"loaded",items:await zo(e,qr)})}catch{c({type:"loadFailed",error:n.teachLoadError})}},[e]);Ms(()=>{f()},[f]),Ms(()=>{p.current?.focus()},[]),Ms(()=>{if(l.status!=="done"||l.moreAvailable!==null)return;let v=!0;return zo(e,1).then(x=>v&&c({type:"more",available:x.length>0})).catch(()=>v&&c({type:"more",available:!1})),()=>{v=!1}},[e,l.status,l.moreAvailable]);let h=uc(async v=>{if(!(!w||l.busy)){c({type:"submit"});try{v==="skip"?(await lu(e,w.id),c({type:"skipped"})):(await iu(e,w.id,v),d.current+=1,c({type:"answered"}),s(!0))}catch(x){if(qg(x)){c({type:"gone"}),s(!1);return}c({type:"submitFailed",error:De(x).error||n.teachSaveError})}}},[e,w,l.busy,s]);return vt("div",{className:"wou-settings-view wou-teach",ref:p,tabIndex:-1,onKeyDown:v=>{let x=v.target;if(x.tagName==="INPUT"||x.tagName==="TEXTAREA"||x.isContentEditable)return;if(v.key==="Escape"){v.preventDefault(),m();return}let b=Hl(v);b==null||!w||(v.preventDefault(),h(b))},"aria-labelledby":"wou-teach-title",children:[vt("div",{className:"wou-settings-view-header",children:[Ne("button",{type:"button",className:"wou-link wou-settings-back",onClick:m,children:n.settingsBack}),Ne("h2",{id:"wou-teach-title",className:"wou-settings-view-title",children:n.teachTitle}),w?Ne("span",{className:"wou-muted wou-teach-progress","aria-live":"polite",children:jl(l)}):null]}),l.status==="loading"?Ne("p",{className:"wou-muted",role:"status",children:n.teachLoading}):null,l.status==="error"?vt("p",{role:"alert",children:[l.error??n.teachLoadError," ",Ne("button",{type:"button",className:"wou-link",onClick:()=>{f()},children:n.retry})]}):null,l.status==="empty"?vt("div",{className:"wou-teach-end",children:[Ne("p",{children:n.teachEmpty}),o?Ne("p",{className:"wou-muted",children:n.firstRunTeachWait}):null,Ne("p",{className:"wou-muted",children:n.teachEmptyNote}),Ne("button",{type:"button",className:"wou-btn-compact",onClick:m,children:n.teachDone})]}):null,l.status==="done"?vt("div",{className:"wou-teach-end",role:"status",children:[Ne("p",{children:l.sorted>0?n.teachFinished(l.sorted):n.teachFinishedNone}),vt("div",{className:"wou-teach-end-actions",children:[l.moreAvailable?Ne("button",{type:"button",className:"wou-btn-compact",onClick:()=>{f()},children:n.teachMore}):null,Ne("button",{type:"button",className:"wou-btn-compact",onClick:m,children:n.teachDone})]})]}):null,w?vt("div",{className:"wou-teach-card",children:[l.index===0&&l.sorted===0?Ne("p",{className:"wou-muted wou-teach-intro",children:n.teachIntro}):null,Ne("p",{className:"wou-teach-ask",children:w.ask}),w.context?Ne("p",{className:"wou-teach-context",children:w.context}):null,vt("p",{className:"wou-muted wou-teach-meta",children:[Ne("span",{children:Bl(w)}),Ne(Dn,{dueAt:w.due_at,now:t})]}),Ne("p",{className:"wou-muted wou-teach-filed",children:zl(w.quadrant)}),Ne("div",{className:"wou-teach-choices",role:"group","aria-label":n.teachTitle,children:hs.map(v=>vt("button",{type:"button",className:`wou-teach-choice wou-teach-choice-q${v.quadrant}${w.quadrant===v.quadrant?" wou-teach-choice-current":""}`,disabled:l.busy,onClick:()=>{h(v.quadrant)},"aria-keyshortcuts":String(v.quadrant),children:[Ne("kbd",{className:"wou-keycap","aria-hidden":"true",children:v.quadrant}),Ne("span",{className:"wou-teach-choice-label",children:v.label}),Ne("span",{className:"wou-muted wou-teach-choice-hint",children:v.hint})]},v.quadrant))}),l.error?vt("p",{className:"wou-teach-error",role:"alert",children:[l.error," ",Ne("span",{className:"wou-muted",children:n.teachSaveRetry})]}):null,vt("div",{className:"wou-teach-footer",children:[vt("button",{type:"button",className:"wou-btn-compact",disabled:l.busy,onClick:()=>{h("skip")},"aria-keyshortcuts":"S",children:[n.teachSkip," ",Ne("kbd",{className:"wou-keycap","aria-hidden":"true",children:"S"})]}),Ne("button",{type:"button",className:"wou-link",onClick:m,children:n.teachDone}),Ne("span",{className:"wou-muted wou-teach-keys",children:n.teachKeysHint})]})]}):null]})}var Vg=/^(\S+) unreachable \(/,Yg=/; using \S+ list cached (.+)$/;function pc(e,t={}){let o=[],a=new Set;for(let s of e??[]){let l=String(s).trim(),c=Vg.exec(l);if(!c)continue;let p=Yg.exec(l),d=c[1].toLowerCase();if(a.has(d))continue;a.add(d);let m=t[d]??c[1].charAt(0).toUpperCase()+c[1].slice(1);o.push({name:m,since:p?.[1]?.trim()||null})}return o}var Xg=/^(\S+): ([1-9]\d*) recent (?:chat uses|chats use) storage label "([A-Za-z0-9_.-]{1,32})"/;function gc(e,t={}){let o=[],a=new Set;for(let s of e??[]){let l=Xg.exec(String(s).trim());if(!l)continue;let c=l[1].toLowerCase(),p=Number(l[2]);if(a.has(c)||!Number.isSafeInteger(p))continue;a.add(c);let d=t[c]??(c==="default"?null:l[1].charAt(0).toUpperCase()+l[1].slice(1));o.push({name:d,count:p,label:l[3]})}return o}function mc(e){return n.storageLabelWarning(e.name,e.count,e.label)}function fc(e){let t=e.failed??0;if(e.model_unreachable||e.succeeded===0&&t>0)return n.scanModelUnreachable;if(t<=0)return null;let o=(e.classification_errors?.[0]??e.errors?.[0])?.trim(),a=o?o.slice(0,120):"unknown error";return n.scanSomeChatsFailed(a)}function wc(e){return e.since?n.machineOfflineCached(e.name,e.since):n.machineOfflineNoCache(e.name)}function hc(e,t,o,a){return{...e,[t]:{token:a,label:o,animDone:!1,responseDone:!1}}}function bc(e,t,o){let a=e[t];if(!a||a.token!==o)return e;let s={...a,animDone:!0};if(s.responseDone){let l={...e};return delete l[t],l}return{...e,[t]:s}}function yc(e,t,o,a){let s=e[t];if(!s||s.token!==o)return e;let l={...s,responseDone:!0,label:a??s.label};if(l.animDone){let c={...e};return delete c[t],c}return{...e,[t]:l}}function kc(e,t,o){let a=e[t];if(!a||a.token!==o)return e;let s={...e};return delete s[t],s}function xc(e,t){return e[t]?.label}import{useEffect as Zg,useLayoutEffect as Jg,useRef as em,useState as vc}from"react";import{jsx as Vo,jsxs as Tc}from"react/jsx-runtime";function pa({label:e,buttonLabel:t,onOpen:o,children:a}){let[s,l]=vc(!1),[c,p]=vc(null),d=em(null);return Jg(()=>{if(!s)return;let m=()=>{let w=d.current?.querySelector("button");if(!w)return;let f=w.getBoundingClientRect(),h=window.innerWidth,$=Math.min(Math.max(f.width,240),360,h-24),v=Math.max(12,Math.min(f.left,h-$-12));p({top:f.bottom+4,left:v,width:$})};return m(),window.addEventListener("resize",m),window.addEventListener("scroll",m,!0),()=>{window.removeEventListener("resize",m),window.removeEventListener("scroll",m,!0)}},[s]),Zg(()=>{if(!s)return;let m=f=>{let h=d.current;h&&!h.contains(f.target)&&l(!1)},w=f=>{f.key==="Escape"&&l(!1)};return document.addEventListener("mousedown",m),document.addEventListener("keydown",w),()=>{document.removeEventListener("mousedown",m),document.removeEventListener("keydown",w)}},[s]),Tc("div",{className:"wou-project-filter-wrap",ref:d,children:[Vo("button",{type:"button",className:"wou-select wou-project-filter-btn","aria-label":e,title:e,"aria-haspopup":"true","aria-expanded":s,onClick:()=>{s||o?.(),l(m=>!m)},children:Vo("span",{className:"wou-project-filter-btn-label",children:t})}),s?Vo("div",{className:"wou-menu wou-project-filter-menu",style:c?{top:c.top,left:c.left,width:c.width}:{visibility:"hidden"},role:"group","aria-label":e,children:a}):null]})}function Ln({checked:e,onChange:t,children:o}){return Tc("label",{className:"wou-project-filter-row",children:[Vo("input",{type:"checkbox",checked:e,onChange:t}),Vo("span",{children:o})]})}import{jsx as Ls,jsxs as fo}from"react/jsx-runtime";function tm(e,t){if(e==="all")return n.projectFilterAll;if(e.length===1){let o=e[0];return o==="none"?n.projectFilterNone:t.find(a=>a.key===o)?.name??n.projectFilterMany(1)}return n.projectFilterMany(e.length)}function nm(e){let t=[];for(let o of e){let a=o.profile||"default",s=t.find(l=>l.profile===a);s||(s={profile:a,projects:[]},t.push(s)),s.projects.push(o)}return t}function Sc({filter:e,projects:t,noProjectCount:o,onChange:a,onOpen:s}){let l=d=>e!=="all"&&e.includes(d),c=nm(t),p=c.length>1;return fo(pa,{label:n.projectFilterLabel,buttonLabel:tm(e,t),onOpen:s,children:[Ls(Ln,{checked:e==="all",onChange:()=>a("all"),children:n.projectFilterAll}),fo(Ln,{checked:l("none"),onChange:()=>a(ts(e,"none")),children:[n.projectFilterNone," ",fo("span",{className:"wou-filter-menu-count",children:["(",o,")"]})]}),t.length===0?Ls("p",{className:"wou-filter-menu-hint",children:n.projectFilterEmpty}):null,c.map(d=>fo("div",{role:"presentation",children:[p?Ls("div",{className:"wou-filter-menu-heading",children:d.profile}):null,d.projects.map(m=>fo(Ln,{checked:l(m.key),onChange:()=>a(ts(e,m.key)),children:[m.name," ",fo("span",{className:"wou-filter-menu-count",children:["(",m.open_count??0,")"]})]},m.key))]},d.profile))]})}import{Fragment as rm,jsx as ga,jsxs as ma}from"react/jsx-runtime";function om(e,t){return e.length===0?n.tagFilterAll:e.length===1?t.find(o=>o.id===e[0])?.name??n.tagFilterMany(1):n.tagFilterMany(e.length)}function Cc({filter:e,tags:t,onChange:o,onOpen:a}){return ma(pa,{label:n.tagFilterLabel,buttonLabel:om(e,t),onOpen:a,children:[ga(Ln,{checked:e.length===0,onChange:()=>o([]),children:n.tagFilterAll}),t.length===0?ga("p",{className:"wou-filter-menu-hint",children:n.tagFilterEmpty}):ma(rm,{children:[t.map(s=>ma(Ln,{checked:e.includes(s.id),onChange:()=>o(tl(e,s.id)),children:[ga("span",{className:`wou-tag-dot ${_t(s.color)}`,"aria-hidden":"true"})," ",s.name," ",ma("span",{className:"wou-filter-menu-count",children:["(",s.open_count??0,")"]})]},s.id)),ga("p",{className:"wou-filter-menu-hint",children:n.tagFilterHint})]})]})}import{createContext as gm,useContext as mm}from"react";function We(e,t){if(t)return!t.profile&&!t.connection?{kind:"main",sessionId:t.session_id}:{kind:"profile",sessionId:t.session_id,profile:t.profile??"default",connection:t.connection,...t.connection_aliases?.length?{aliases:t.connection_aliases}:{}};if(!e.includes(":"))return{kind:"main",sessionId:e};let[o,a]=[e.slice(0,e.indexOf(":")),e.slice(e.indexOf(":")+1)];return/^\d{8}_\d{6}_[0-9a-f]+$|^[0-9a-f]{12}$|^local-[0-9a-f]{64}$/i.test(a)?{kind:"profile",sessionId:a,profile:o.toLowerCase(),connection:null}:{kind:"not-a-chat",source:e.split(":",1)[0]}}function Nc(e,t,o=null){return t?{profile:t.profile,connectionId:t.connectionId}:{profile:e.profile,connectionId:e.connection??o}}var am={mailhist:"support mail history",ntfy:"an ntfy alert"};function Pc(e,t,o){let s=[`From Waiting On You (${am[e.toLowerCase()]??e}): ${t}`,""];for(let l of o){let c=l.ask.trim();if(!c)continue;let p=l.topic?.trim();s.push(`- ${p&&p!==t?`${p}: `:""}${c}`);let d=l.source_excerpt?.trim();if(d){s.push("  Source:");for(let w of d.split(`
`))s.push(`    ${w}`)}let m=(l.actions??[]).filter(w=>(w.kind??"run")==="run").map(w=>w.label);m.length>0&&s.push(`  Options on the card: ${m.join(", ")}`)}return s.push("","Help me handle this."),s.join(`
`)}function Ac(e,t,o,a,s=[]){let l=t.trim().toLowerCase()||"default",c=e.filter(p=>(p.targetProfile||p.profile||"").toLowerCase()===l);if(o){for(let p of[o,...s]){let d=c.find(m=>m.connectionId===p);if(d)return d}return null}return(a?c.find(p=>p.connectionId===a):void 0)??c.find(p=>p.primary)??null}function Yo(e){let t=e?.trim();return(t||"default").toLowerCase()}function _c(e){let t=e.owner?.connectionId?.trim();return!!(t&&t!=="local"||Yo(e.owner?.profile)!=="default"||Yo(e.profile)!=="default")}function sm(e){let t=new Set;e.connection&&t.add(e.connection);for(let o of e.aliases??[]){let a=o.trim();a&&t.add(a)}return t}function im(e,t){let o=Yo(t.owner?.profile??t.profile),a=Yo(e.profile);if(o!==a)return!1;let s=t.owner?.connectionId?.trim();if(!s||s==="local")return!e.connection;let l=sm(e);return l.size===0?!0:l.has(s)}function $c(e,t){if(!t.sessionId||e.status==="done"||e.status==="dismissed")return!1;let o=We(e.chat_key,e.chat_target);return o.kind==="not-a-chat"||o.sessionId!==t.sessionId?!1:o.kind==="main"||!_c(t)?!0:im(o,t)}function Ec(e,t){return!(!$c(e,t)||We(e.chat_key,e.chat_target).kind==="main"&&_c(t))}function Os(e,t,o){let a=e.filter(f=>$c(f,o));if(a.length===0)return null;let s=a[0].chat_key,l=a.filter(f=>f.chat_key===s),c=t.find(f=>f.chat_key===s),p=c?.quadrant??Math.min(...l.map(f=>f.quadrant)),d=l[0].agent,m=c?.project??l.find(f=>f.project)?.project??null,w=[];for(let f of l)for(let h of f.tags??[])w.some($=>$.id===h.id)||w.push(h);return{chatKey:s,quadrant:p,agent:d,project:m,tags:w,kind:l.length>=2?"group":"task"}}function Rc(e){if(!e.sessionId)return null;let t=Yo(e.owner?.profile??e.profile),o=e.owner?.connectionId?.trim()??"";return`${e.sessionId}\0${t}\0${o}`}function lm(e,t,o,a=[]){return os(e,t,o,a)}function Ic(e,t){if(!e)return null;for(let o of e){let a=o.entries.findIndex(s=>ms(s)===t);if(a>=0)return{section:o,index:a}}return null}function Dc(e,t,o,a=15){let s={};lm(e,o.agentFilter,o.projectFilter,o.tagFilter??[])||(s.agentFilter="all",s.projectFilter="all",s.tagFilter=[]),o.searchActive&&(s.closeSearch=!0);let l=Ic(t,e.chatKey);if(l){let c=l.section.key;o.collapsed[c]&&(s.collapsed={...o.collapsed,[c]:!1}),l.index>=a&&!o.expandedSections[c]&&(s.expandedSections={...o.expandedSections,[c]:!0})}return e.kind==="group"&&o.groupExpanded[e.chatKey]===!1&&(s.groupExpanded={...o.groupExpanded,[e.chatKey]:!0}),s}function Mc(e,t,o,a,s,l){if(!t)return o.some(d=>ms(d)===e.chatKey);let c=Ic(t,e.chatKey);if(!c)return!1;let p=c.section.key;return l[p]?!1:s[p]?!0:c.index<a}var Lc={caps:{busy:!1,awaitingResponse:!1,busyBySession:!1,focusedStoredSessionId:!1,focusedSessionId:!1},selection:{sessionId:null,profile:null,owner:null},busy:!1,awaitingResponse:!1,busyBySession:{},focusedSessionId:null};function fa(e){let t=e??{};return{busy:typeof t.busy<"u",awaitingResponse:typeof t.awaitingResponse<"u",busyBySession:typeof t.busyBySession<"u",focusedStoredSessionId:typeof t.focusedStoredSessionId<"u",focusedSessionId:typeof t.focusedSessionId<"u"}}function um(e){return!e.caps.busy&&!(e.caps.busyBySession&&e.caps.focusedSessionId)?null:e.caps.busy?e.busy:e.caps.focusedSessionId&&e.focusedSessionId?!!e.busyBySession[e.focusedSessionId]:!1}function Oc(e,t,o,a){if(We(e.chat_key,e.chat_target).kind==="not-a-chat")return[];let l=(e.chat_title||e.topic||e.chat_key).trim()||"chat";if(!Ec(e,t.selection))return[];let p=a?.showReadUnavailable!==!1,d=[],m=um(t);return m===!0&&d.push({kind:"working",label:o.presenceWorking,ariaLabel:o.presenceWorkingAria(l)}),!t.caps.awaitingResponse&&m===!0&&d.push({kind:"responded",label:o.presenceRespondedUnavailable,ariaLabel:o.presenceRespondedUnavailableAria,available:!1}),p&&m===!0&&d.push({kind:"read",label:o.presenceReadUnavailable,ariaLabel:o.presenceReadUnavailableAria,available:!1}),d}import{host as Gt,useValue as hn}from"@hermes/plugin-sdk";import{useMemo as pm}from"react";function Fc(e){let t=fa(e.capsState),o={sessionId:e.focusedStored??e.sessionActive,profile:e.profile,owner:e.owner};return{caps:t,selection:o,busy:e.busy,awaitingResponse:e.awaitingResponse,busyBySession:e.busyBySession,focusedSessionId:e.focusedRuntime}}var cm=()=>()=>{};function On(e){return{get:()=>e,subscribe:cm}}var dm={},wn={focusedStoredSessionId:On(null),focusedSessionId:On(null),focusedSessionProfile:On(null),focusedSessionOwner:On(null),busy:On(!1),awaitingResponse:On(!1),busyBySession:On(dm)};function jc(){let e=Gt.state.focusedStoredSessionId??wn.focusedStoredSessionId,t=Gt.state.focusedSessionId??wn.focusedSessionId,o=Gt.state.focusedSessionProfile??wn.focusedSessionProfile,a=Gt.state.focusedSessionOwner??wn.focusedSessionOwner,s=Gt.state.busy??wn.busy,l=Gt.state.awaitingResponse??wn.awaitingResponse,c=Gt.state.busyBySession??wn.busyBySession,p=hn(e),d=hn(t),m=hn(Gt.state.activeSessionId),w=hn(o),f=hn(a),h=hn(s),$=hn(l),v=hn(c),x=fa(Gt.state);return pm(()=>Fc({capsState:Gt.state,focusedStored:p,focusedRuntime:d,sessionActive:m,profile:w,owner:f,busy:h,awaitingResponse:$,busyBySession:v}),[p,d,m,w,f,h,$,v,x.busy,x.awaitingResponse,x.busyBySession,x.focusedSessionId,x.focusedStoredSessionId])}import{jsx as fm}from"react/jsx-runtime";var zc=gm(null);function Hc({children:e}){let t=jc();return fm(zc.Provider,{value:t,children:e})}function Bc(){return mm(zc)??Lc}import{useEffect as or,useLayoutEffect as Fm,useRef as zn,useState as It}from"react";import{useMemo as wm}from"react";import{jsx as Fs}from"react/jsx-runtime";function wo({text:e,tokens:t,className:o}){let a=wm(()=>Sl(e,t),[e,t]);if(a.length===0)return Fs("span",{className:o,children:e});let s=[],l=0;for(let[c,p]of a)c>l&&s.push(e.slice(l,c)),s.push(Fs("mark",{className:"wou-search-mark",children:e.slice(c,p)},c)),l=p;return l<e.length&&s.push(e.slice(l)),Fs("span",{className:o,children:s})}import{host as Fn}from"@hermes/plugin-sdk";function js(e){return e instanceof Error?e.message:String(e)}function hm(){let e=globalThis.hermesDesktop,t=e?.openSessionWindow;return typeof t=="function"?t.bind(e):null}function bm(e,t){return new Promise((o,a)=>{let s=setTimeout(()=>a(new Error(`timed out after ${t}ms`)),t);e.then(l=>{clearTimeout(s),o(l)},l=>{clearTimeout(s),a(l)})})}var ym=e=>new Promise(t=>setTimeout(t,e));async function km(e,t,o,a,s){e("/");let l=t?.setDraft,c=t?.getDraft;if(typeof l!="function"||typeof c!="function")throw new Error("could not fill the new chat");let p=async()=>{let d=await c("new");return typeof d=="string"&&d.trim()?(s(),!0):!1};if(!await p()){for(let d=0;d<15;d++){if(await ym(d===0?50:150),await p())return;if(await l("new",o)){a();return}}throw new Error("could not fill the new chat")}}async function Uc(e){let t=Fn.openSession;typeof t=="function"?await t(e,{intent:"in-place"}):Fn.navigate(`/${e}`)}async function on(e,t,o,a,s=[]){let l=We(t,a),c=Fn,p=c.openSession;try{if(l.kind==="not-a-chat"){await km(f=>Fn.navigate(f),c.composer,Pc(l.source,o,s),()=>ie(n.chatContextReady),()=>ie(n.chatNewDraftBlocked));return}if(l.kind==="main"){typeof p=="function"?await p(l.sessionId,{intent:"in-place"}):Fn.navigate(`/${l.sessionId}`);return}let d=null;if(typeof c.profileRoutes=="function"){let f=await bm(c.profileRoutes(),3e3).catch(h=>(ie(`Could not list profile routes (${js(h)}); trying defaults.`),[]));d=Ac(f,l.profile,l.connection,Fn.state.connectionId.get(),l.aliases)}let m=hm();if(m){let f=Nc(l,d,Fn.state.connectionId.get()),h=await m(l.sessionId,f);if(h&&h.ok===!1)throw new Error(h.error||"the window did not open");return}if(typeof p!="function")throw new Error("this Desktop build cannot open other agents\u2019 chats");let w={intent:"in-place",keepAllProfilesScope:!0,profile:l.profile,forceResume:!0};d&&(w.route=d),await p(l.sessionId,w)}catch(d){console.warn("[waiting-on-you] open chat failed",{chatKey:t,target:a,error:js(d)}),de(n.chatOpenFailed(o,js(d)),JSON.stringify({chatKey:t,target:a}))}}import{jsx as Gc,jsxs as Wc}from"react/jsx-runtime";function wa({onClick:e}){return Wc("button",{type:"button",className:"wou-link wou-chat-link wou-open-session-link",onClick:e,children:[n.openSession,Gc(Ho,{className:"wou-external-link-icon"})]})}function ha({agent:e,onClick:t}){return Wc("button",{type:"button",className:"wou-link wou-chat-link wou-open-session-link",onClick:t,children:[n.handleWithAgent(e),Gc(Ho,{className:"wou-external-link-icon"})]})}import{useEffect as Tm,useRef as zs}from"react";function Kc(e){return!(!e||e.closest(".wou-group-children")||e.closest('button, a, input, textarea, select, [role="menu"], [role="alertdialog"]'))}function Qc(e){return!e.pending&&!e.confirmClose&&!e.renameOpen&&!e.aiQuick&&!e.customSnoozeOpen&&!e.checkboxDisabled}function qc(e,t,o,a){return e!=="F10"||!t?!1:o===a}function Vc(e){return e?"done-all":"confirm"}function Yc(e,t,o){e==="done-all"?o():t()}function Xc(e,t,o){return e==="Escape"?{action:"escape"}:e==="Tab"?{action:"tab-dismiss"}:e==="Enter"&&o?{action:"activate",altKey:t}:null}import{useLayoutEffect as xm,useState as vm}from"react";var Xo=8,Zo=4;function ba(e,t,o){let[a,s]=vm(null);return xm(()=>{if(!e){s(null);return}let l=()=>{let c=t.current,p=o.current;if(!c||!p)return;let d=p.getBoundingClientRect(),m=window.innerWidth,w=window.innerHeight,f=c.style.maxHeight;c.style.maxHeight="none";let h=c.scrollHeight,$=c.offsetWidth;c.style.maxHeight=f;let v=w-d.bottom-Zo-Xo,x=d.top-Zo-Xo,b,C;h<=v?b=d.bottom+Zo:h<=x?b=d.top-Zo-h:v>=x?(b=d.bottom+Zo,C=v):(b=Xo,C=x);let _=Math.max(Xo,Math.min(d.right-$,m-$-Xo));s({top:b,left:_,maxHeight:C})};return l(),window.addEventListener("resize",l),window.addEventListener("scroll",l,!0),()=>{window.removeEventListener("resize",l),window.removeEventListener("scroll",l,!0)}},[e,t,o]),a}import{jsx as ho,jsxs as Sm}from"react/jsx-runtime";function Zc({open:e,onClose:t,menuRef:o,anchorRef:a,onConfirmClose:s,onDoneAll:l}){let c=ba(e,o,a),p=zs(t);p.current=t;let d=zs(s);d.current=s;let m=zs(l);m.current=l;let w=f=>{p.current("activate"),Yc(Vc(f),d.current,m.current)};return Tm(()=>{if(!e)return;let f=o.current;if(!f)return;let h=()=>f.querySelector("button.wou-menu-row"),$=requestAnimationFrame(()=>h()?.focus()),v=x=>{let b=h(),C=!!(b&&document.activeElement===b),_=Xc(x.key,x.altKey,C);if(_){if(_.action==="escape"){x.preventDefault(),p.current("escape");return}if(_.action==="tab-dismiss"){p.current("tab");return}_.action==="activate"&&(x.preventDefault(),w(_.altKey))}};return f.addEventListener("keydown",v),()=>{cancelAnimationFrame($),f.removeEventListener("keydown",v)}},[e,o]),e?ho("div",{className:"wou-menu wou-menu-floating wou-menu-notion",style:c??{visibility:"hidden"},ref:o,role:"menu","aria-label":n.closeAllTasks,children:Sm("button",{type:"button",role:"menuitem",className:"wou-menu-row",title:n.groupCheckboxTip,onClick:f=>w(f.altKey),children:[ho("span",{className:"wou-menu-row-icon","aria-hidden":"true",children:ho(so,{})}),ho("span",{className:"wou-menu-row-label",children:n.closeAllTasks}),ho("span",{className:"wou-menu-row-trail",children:ho("kbd",{className:"wou-menu-kbd",children:n.renameAltHint})})]})}):null}import{useEffect as Jc,useRef as Cm,useState as Nm}from"react";import{Fragment as ed,jsx as X,jsxs as ya}from"react/jsx-runtime";var Pm=[1,2,3,4];function bo(){return X("div",{className:"wou-menu-sep",role:"presentation"})}function Hs({children:e}){return X("div",{className:"wou-menu-section",role:"presentation",children:e})}function Rt({icon:e,label:t,trailing:o,danger:a,onActivate:s,role:l="menuitem","aria-checked":c,altAction:p,title:d}){return ya("button",{type:"button",role:l,"aria-checked":c,"data-alt-action":p,title:d,className:`wou-menu-row${a?" wou-menu-row-danger":""}`,onClick:m=>s({altKey:m.altKey}),children:[X("span",{className:"wou-menu-row-icon","aria-hidden":"true",children:e}),X("span",{className:"wou-menu-row-label",children:t}),o?X("span",{className:"wou-menu-row-trail",children:o}):null]})}function Am({quadrant:e}){return X("span",{className:`wou-menu-priority-sq wou-quadrant-dot-${e}`,"aria-hidden":"true"})}function ka({open:e,onClose:t,menuRef:o,anchorRef:a,quadrant:s,tags:l,tagState:c,showWhyHere:p,hidePriority:d=!1,onRename:m,onRenameWithAi:w,onSnoozeTomorrow:f,onSnoozeMonday:h,onSnoozeWeek:$,onCustomSnooze:v,onToggleTag:x,onNewTag:b,onQuadrant:C,onWhyHere:_,onCloseAll:O,onCloseAllNow:Z,onDismiss:ce,dismissLabel:te}){let E=ba(e,o,a),K=Cm(t);K.current=t;let[J,B]=Nm(!1);if(Jc(()=>{if(!e||!w){B(!1);return}let z=Ae=>B(Ae.altKey),ne=()=>B(!1);return window.addEventListener("keydown",z,!0),window.addEventListener("keyup",z,!0),window.addEventListener("mousemove",z,!0),window.addEventListener("blur",ne),()=>{window.removeEventListener("keydown",z,!0),window.removeEventListener("keyup",z,!0),window.removeEventListener("mousemove",z,!0),window.removeEventListener("blur",ne)}},[e,w]),Jc(()=>{if(!e)return;let z=o.current;if(!z)return;let ne=()=>Array.from(z.querySelectorAll("button.wou-menu-row")),Ae=me=>{let Y=ne();if(Y.length===0)return;let he=(me%Y.length+Y.length)%Y.length;Y[he]?.focus()},je=requestAnimationFrame(()=>Ae(0)),Se=me=>{if(me.key==="Escape"){K.current();return}let Y=ne();if(Y.length===0)return;let he=document.activeElement,q=Y.findIndex(S=>S===he);if(me.key==="ArrowDown")me.preventDefault(),Ae(q<0?0:q+1);else if(me.key==="ArrowUp")me.preventDefault(),Ae(q<0?Y.length-1:q-1);else if(me.key==="Enter"&&q>=0){me.preventDefault();let S=Y[q];me.altKey&&S?.dataset.altAction==="rename-ai"?S.dispatchEvent(new MouseEvent("click",{bubbles:!0,altKey:!0})):S?.click()}};return z.addEventListener("keydown",Se),()=>{cancelAnimationFrame(je),z.removeEventListener("keydown",Se)}},[e,o]),!e)return null;let j=()=>t();return ya("div",{className:"wou-menu wou-menu-floating wou-menu-notion",style:E??{visibility:"hidden"},ref:o,role:"menu",children:[O?X(Rt,{icon:X(so,{}),label:n.closeAllTasks,trailing:X("kbd",{className:"wou-menu-kbd",children:n.renameAltHint}),title:n.groupCheckboxTip,onActivate:z=>{j(),Z&&(z.altKey||J)?Z():O()}}):null,O?X(bo,{}):null,X(Rt,{icon:J?X(gn,{}):X(fu,{}),label:J?n.renameWithAi:n.rename,trailing:w&&!J?X("kbd",{className:"wou-menu-kbd",children:n.renameAltHint}):void 0,altAction:w?"rename-ai":void 0,title:w?n.renameWithAiTip:void 0,onActivate:z=>{j(),w&&(z.altKey||J)?w():m()}}),X(bo,{}),X(Hs,{children:n.menuSectionSnooze}),X(Rt,{icon:X(wu,{}),label:n.snoozeTomorrowShort,onActivate:()=>{j(),f()}}),X(Rt,{icon:X(hu,{}),label:n.snoozeMondayShort,onActivate:()=>{j(),h()}}),X(Rt,{icon:X(bu,{}),label:n.snoozeWeekShort,onActivate:()=>{j(),$()}}),X(Rt,{icon:X(yu,{}),label:n.snoozeCustomShort,onActivate:()=>{j(),v()}}),X(bo,{}),X(Hs,{children:n.menuSectionTags}),l.length>0?X("div",{className:`wou-menu-tag-list${l.length>6?" wou-menu-tag-list-scroll":""}`,role:"presentation",children:l.map(z=>{let ne=c(z.id);return X(Rt,{role:"menuitemcheckbox","aria-checked":ne==="all"?!0:ne==="some"?"mixed":!1,icon:X("span",{className:`wou-tag-dot ${_t(z.color)}`}),label:z.name,trailing:ne==="all"?X(so,{}):ne==="some"?X("span",{className:"wou-menu-tag-check",children:"\u2013"}):void 0,onActivate:()=>x(z,ne)},z.id)})}):null,X(Rt,{icon:X(ku,{}),label:n.tagNew,onActivate:()=>{j(),b()}}),d?null:ya(ed,{children:[X(bo,{}),X(Hs,{children:n.menuSectionPriority}),Pm.map(z=>X(Rt,{role:"menuitemradio","aria-checked":z===s,icon:X(Am,{quadrant:z}),label:n[`quadrantBar${z}`],trailing:z===s?X(so,{}):void 0,onActivate:()=>{z!==s&&(j(),C(z))}},z))]}),p?ya(ed,{children:[X(bo,{}),X(Rt,{icon:X(xu,{}),label:n.whyHere,onActivate:()=>{j(),_()}})]}):null,X(bo,{}),X(Rt,{icon:X(vu,{}),label:te,danger:!0,onActivate:()=>{j(),ce()}})]})}import{useEffect as Ca,useRef as Ks,useState as Wt}from"react";import{useState as td}from"react";import{jsx as xa,jsxs as nd}from"react/jsx-runtime";function od({ctx:e,task:t,excerptOpen:o,onToggleExcerpt:a,onReload:s,disabled:l=!1}){let c=t.actions??[],[p,d]=td(null),[m,w]=td(null);if(c.length===0)return null;let f=p!=null,h=l||f,$=async b=>{d(b.id),w(null);try{let C=await Xl(e,t.id,b.id);C.ok?(ie(C.message),s()):de(C.message)}catch(C){let _=C instanceof Error?C.message:String(C);de(_)}finally{d(null)}},v=b=>{if(h)return;if((b.kind??"run")==="details"){a(!o);return}if(b.confirm?.trim()){w(b.id);return}$(b)},x=c.find(b=>b.id===m);return nd("div",{className:"wou-card-actions",children:[c.map(b=>{let C=b.kind??"run",_=b.style??"default",O=p===b.id,Z=["wou-action-btn",_==="primary"?"wou-action-btn-primary":"",_==="danger"?"wou-action-btn-danger":""].filter(Boolean).join(" "),ce=O?`${b.label}${n.actionRunningSuffix}`:b.label;return xa("button",{type:"button",className:Z,disabled:h,"aria-pressed":C==="details"&&o||void 0,onClick:()=>v(b),children:ce},b.id)}),x?.confirm?nd("div",{className:"wou-action-confirm",role:"alertdialog",children:[xa("span",{className:"wou-action-confirm-text",children:x.confirm}),xa("button",{type:"button",className:"wou-action-btn wou-action-btn-primary",disabled:h,onClick:()=>{$(x)},children:n.yes}),xa("button",{type:"button",className:"wou-action-btn",disabled:h,onClick:()=>w(null),children:n.renameCancel})]}):null]})}import{useEffect as dd,useRef as pd,useState as gd}from"react";var Bs=4e3;function _m(e,t){let o=Math.min(Math.max(t,0),e.length);return o>0&&e.charCodeAt(o-1)>=55296&&e.charCodeAt(o-1)<=56319&&(o-=1),e.slice(0,o)}var rd=5e3,$m=[/^(say|reply|answer|decide|confirm|check|let \w+ know)\s+(whether|if)\b/,/^tell(\s+[\w’'-]+){0,3}\s+(whether|if)\b/,/^(say|reply|answer)\s+(yes|no|ok|okay|go|ship)\b/,/^(approve|confirm|ok|okay|allow|authorize|authorise|green-?light|sign off on)\b/,/^(should|shall|can|could|may|do|does|did|is|are|was|will|would|want)\b.*\?$/];function Jo(e){let t=e.trim().replace(/\s+/g," ").toLowerCase().replace(/\byes or no\b/g,"yes-no");return!t||/\bor\b/.test(t)||/^(which|what|who|when|where|how|why)\b/.test(t)?!1:$m.some(o=>o.test(t))}function ad(e,t,o=""){let a;if(e==="yes")a="Yes.";else if(e==="no")a="No.";else if(a=_m(o.trim(),Bs).trim(),!a)return null;let s=t.trim().replace(/\s+/g," ");return s?`${a}

(Answering from Waiting On You: \u201C${s}\u201D)`:a}var Em={y:"yes",n:"no",r:"reply",l:"later",o:"open",j:"next",arrowdown:"next",k:"prev",arrowup:"prev"};function sd(e){return e.typing||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey?null:Em[e.key.toLowerCase()]??null}function id(e,t,o){if(e.length===0)return null;let a=t==null?-1:e.indexOf(t);return a<0?o===1?e[0]:e[e.length-1]:e[Math.min(e.length-1,Math.max(0,a+o))]}function ld(e,t,o){if(o==null)return null;if(t.includes(o))return o;if(t.length===0)return null;let a=new Set(t),s=e.indexOf(o);if(s>=0){for(let l=s+1;l<e.length;l++)if(a.has(e[l]))return e[l];for(let l=s-1;l>=0;l--)if(a.has(e[l]))return e[l]}return t[0]}function Us(e){let t=e.composer;return!!(t&&typeof t.getDraft=="function"&&typeof t.submit=="function")}function ud(e,t){let o=e?.trim();return{profile:(t?.trim()||"default").toLowerCase(),connectionId:o&&o!=="local"?o:null}}function er(e,t){return e.profile===t.profile&&e.connectionId===t.connectionId}async function Rm(e,t,o){if(e.shownSessionId()!==o)return!1;let a=await t.getDraft(o);return a==null?!1:a===""?!0:await t.getDraft(null)===a&&e.shownSessionId()===o}async function cd(e,t,o){let a=e.composer;if(!o.trim()||!t||!a||!Us({composer:a}))return!1;let s=a,l=()=>e.signal?.aborted===!0,c=()=>e.inScope==null||e.inScope(),p=async()=>l()||!c()||!await Rm(e,s,t)||l()||!c()?!1:s.submit(t,o);if(await p())return!0;if(l()||!c())return!1;await e.openInPlace(t);let d=Math.max(1,Math.ceil(e.timeoutMs/e.pollMs));for(let m=0;m<d;m++){if(l()||!c()||(await e.sleep(e.pollMs),l()||!c()))return!1;if(await p())return!0}return!1}function tr(e,t,o={profile:"default",connectionId:null}){return!t||e.status!=="open"||o.profile!=="default"||nr(e)?!1:We(e.chat_key,e.chat_target).kind==="main"}function nr(e){return e.status!=="open"?null:We(e.chat_key,e.chat_target).kind==="profile"?"other-window":null}import{Fragment as Im,jsx as dt,jsxs as jn}from"react/jsx-runtime";function md({task:e,controls:t,visible:o,canAnswer:a,yesNo:s,openLabel:l,unsupportedNote:c=null,onDone:p,disabled:d=!1}){let[m,w]=gd(!1),[f,h]=gd(""),$=pd(null),v=t.phase(e.id),x=t.replyRequest,b=pd(x?.n??0);if(dd(()=>{!x||x.n<=b.current||(b.current=x.n,x.taskId===e.id&&a&&w(!0))},[x?.n,x?.taskId,e.id,a]),dd(()=>{if(!m)return;let O=$.current;O&&(O.focus({preventScroll:!0}),O.scrollIntoView({block:"nearest"}))},[m]),v){let O=t.answerLabel(e.id)??"";return jn("div",{className:"wou-answer-pending",role:"status",children:[dt("span",{children:v==="waiting"?n.answerWaiting(O):n.answerSending(O)}),v==="waiting"?dt("button",{type:"button",className:"wou-action-btn",onClick:()=>t.cancel(e),children:n.answerUndo}):null]})}if(!o)return null;let C=()=>{w(!1),h("")},_=()=>{f.trim()&&(t.answer(e,"reply",f),C())};return jn("div",{className:"wou-answer",role:"group","aria-label":n.answerBarRegion,children:[jn("div",{className:"wou-answer-bar",children:[a&&s?jn(Im,{children:[dt("button",{type:"button",className:"wou-action-btn wou-answer-yes",title:n.answerYesTip,disabled:d,onClick:()=>t.answer(e,"yes"),children:n.answerYes}),dt("button",{type:"button",className:"wou-action-btn wou-answer-no",title:n.answerNoTip,disabled:d,onClick:()=>t.answer(e,"no"),children:n.answerNo})]}):null,a?dt("button",{type:"button",className:"wou-action-btn",title:n.answerReplyTip,"aria-expanded":m,disabled:d,onClick:()=>m?C():w(!0),children:n.answerReply}):null,p?dt("button",{type:"button",className:"wou-action-btn",title:n.answerDoneTip,disabled:d,onClick:p,children:n.answerDone}):null,dt("button",{type:"button",className:"wou-action-btn",title:n.answerLaterTip,disabled:d,onClick:()=>t.later(e),children:n.answerLater}),jn("button",{type:"button",className:"wou-action-btn wou-answer-open",title:c?`${n.answerOpenTip}. ${c}`:n.answerOpenTip,"aria-describedby":c?`wou-answer-unsupported-${e.id}`:void 0,onClick:()=>t.open(e),children:[l,dt(Ho,{className:"wou-external-link-icon"})]})]}),c?dt("p",{className:"wou-answer-unsupported",id:`wou-answer-unsupported-${e.id}`,role:"note",children:c}):null,m&&a?jn("form",{className:"wou-answer-reply",onSubmit:O=>{O.preventDefault(),_()},children:[dt("textarea",{ref:$,className:"wou-answer-reply-input","aria-label":n.answerReplyLabel,placeholder:n.answerReplyPlaceholder,value:f,maxLength:Bs,rows:2,disabled:d,onChange:O=>h(O.target.value),onKeyDown:O=>{if(O.key==="Escape"){O.preventDefault(),O.stopPropagation(),C();return}O.key==="Enter"&&!O.shiftKey&&!O.nativeEvent.isComposing&&(O.preventDefault(),_())}}),jn("div",{className:"wou-answer-reply-actions",children:[dt("button",{type:"submit",className:"wou-action-btn wou-action-btn-primary",disabled:d||!f.trim(),children:n.answerReplySend}),dt("button",{type:"button",className:"wou-action-btn",onClick:C,children:n.answerReplyCancel}),dt("span",{className:"wou-muted wou-answer-reply-hint",children:n.answerReplyHint})]})]}):null]})}import{createContext as Dm,useContext as Mm}from"react";var Gs=Dm(null);function va(){return Mm(Gs)}import{useCallback as fd,useEffect as Lm,useRef as Ws,useState as wd}from"react";function Ta(e,t){let[o,a]=wd(!1),[s,l]=wd(null),c=Ws(0),p=Ws(!0),d=Ws(t);d.current=t,Lm(()=>(p.current=!0,()=>{p.current=!1,c.current+=1}),[]);let m=fd(()=>{c.current+=1,a(!1),l(null)},[]),w=fd(async()=>{let f=++c.current;a(!0),l(null);try{let h=(await Yl(e,d.current)).trim();return!p.current||f!==c.current?null:h||(l(n.renameWithAiFailed),null)}catch(h){return!p.current||f!==c.current||l(De(h).error||n.renameWithAiFailed),null}finally{p.current&&f===c.current&&a(!1)}},[e]);return{busy:o,error:s,setError:l,generate:w,cancel:m}}import{jsx as hd}from"react/jsx-runtime";var Om={presenceWorking:n.presenceWorking,presenceWorkingAria:n.presenceWorkingAria,presenceResponded:n.presenceResponded,presenceRespondedAria:n.presenceRespondedAria,presenceRespondedUnavailable:n.presenceRespondedUnavailable,presenceRespondedUnavailableAria:n.presenceRespondedUnavailableAria,presenceReadUnavailable:n.presenceReadUnavailable,presenceReadUnavailableAria:n.presenceReadUnavailableAria};function Sa({task:e,showReadUnavailable:t=!0}){let o=Bc(),a=Oc(e,o,Om,{showReadUnavailable:t});return a.length===0?null:hd("span",{className:"wou-chat-presence",role:"group","aria-label":n.presenceGroupAria,children:a.map(s=>hd("span",{className:`wou-chat-presence-item wou-muted${s.kind==="working"?" wou-chat-presence-working":""}${s.kind!=="working"&&"available"in s&&!s.available?" wou-chat-presence-na":""}`,role:"status","aria-label":s.ariaLabel,children:s.label},s.kind))})}import{jsx as V,jsxs as Tt}from"react/jsx-runtime";function yo({ctx:e,task:t,allTags:o,nameAfterChat:a=!1,closed:s,nested:l,groupTitle:c,pendingLabel:p,checkboxDisabled:d,onDone:m,onDismiss:w,onSnooze:f,onMoveQuadrant:h,onToggleTag:$,onCreateTag:v,onProjectClick:x,onRename:b,onReopen:C,onReload:_,highlightTokens:O=[],followHighlighted:Z=!1,showProjectChips:ce=!1,showPriorities:te=!0,showAgentChip:E=!0,defaultDetailsOpen:K=!1,inNextUp:J=!1,updatedNow:B=new Date}){let j=va(),[z,ne]=Wt(!1),[Ae,je]=Wt(K),[Se,me]=Wt(!1),Y=t.source_excerpt?.trim()??"",[he,q]=Wt(!1),[S,H]=Wt(!1),[we,xe]=Wt(!1),[ve,Re]=Wt(""),[Ie,oe]=Wt(()=>oo(new Date)),[_e,le]=Wt(null),P=Ks(null),U=Ks(null),fe=Ks(null),Te=!!p,I=An(t,a,!!l),ue=Ta(e,{task_id:t.id}),[Le,y]=Wt(!1);Ca(()=>{if(!S)return;let M=fe.current;M&&(M.focus(),M.select())},[S]),Ca(()=>{if(!z)return;let M=ze=>{let Vt=ze.target;U.current?.contains(Vt)||P.current?.contains(Vt)||ne(!1)};return document.addEventListener("mousedown",M),()=>document.removeEventListener("mousedown",M)},[z]),Ca(()=>{if(!z&&!he&&!S)return;let M=ze=>{ze.key==="Escape"&&(ne(!1),q(!1),S&&(ue.cancel(),H(!1),Re(I)),le(null))};return document.addEventListener("keydown",M),()=>document.removeEventListener("keydown",M)},[z,he,S,I]);let G=async()=>{await on(e,t.chat_key,t.chat_title,t.chat_target,[t])},be=en(new Date),Oe=Oo(Math.floor(Date.now()/1e3)),Ce=()=>{ne(!1),oe(oo(new Date)),le(null),q(!0)},tt=()=>{ne(!1),ue.cancel(),y(!1),Re(I),H(!0)},pt=()=>{ue.cancel(),H(!1),Re(I)},kn=async()=>{if(ue.busy)return;let M=await ue.generate();M&&(Re(M),requestAnimationFrame(()=>{let ze=fe.current;ze&&(ze.focus(),ze.select())}))},Qt=async()=>{if(ne(!1),!ue.busy){y(!0);try{let M=await ue.generate();if(!M)return;if((t.title_override?.trim()||(l?"":t.chat_name?.trim())||"")===M){ie(n.renameWithAiSame);return}b(t,M)}finally{y(!1)}}};Ca(()=>{!Le&&ue.error&&!S&&(de(n.renameWithAiFailed,ue.error),ue.setError(null))},[Le,ue.error,S]);let Dt=()=>{let M=Cl(ve,I,t.title_override);if(M.action==="close"){H(!1);return}H(!1),b(t,M.value??null)},xn=()=>{let M=Br(Ie),ze=Math.floor(Date.now()/1e3);if(M==null||M<=ze){le(n.snoozePast);return}q(!1),le(null),f(t,M)},Xe=!l&&te,gt=ce&&!l,an=es(t),sn=l?"":Ur(an,B),mt=l?"":Gr(an),qe=I.trim(),St=l&&!S&&(!qe||c!=null&&qe.toLowerCase()===c.trim().toLowerCase()),Mt=t.ask.trim(),qt=Mt.length>60?`${Mt.slice(0,60).trimEnd()}\u2026`:Mt,ln=gt&&t.project?V(ra,{project:t.project,onClick:x}):null,ft=bt(t),wt=t.context?.trim()??"",So=E||!!ln||ft.length>0||!!s||t.due_at!=null,Lt=We(t.chat_key,t.chat_target).kind==="not-a-chat",Ct=!!j&&!s&&j?.activeId===t.id,Nt=j&&!s?V(md,{task:t,controls:j,visible:!Te&&!S&&(J||Ct||j.showAll),canAnswer:tr(t,j.canSubmit),yesNo:Jo(t.ask),openLabel:Lt?n.handleWithAgent(t.agent):n.openSession,unsupportedNote:nr(t)?n.answerUnsupported:null,onDone:J?()=>m(t):void 0,disabled:Te||!!d}):null,it=Lt?V(ha,{agent:t.agent,onClick:()=>{G()}}):V(wa,{onClick:()=>{G()}}),Un=!s&&(t.actions?.length??0)>0&&_?V(od,{ctx:e,task:t,excerptOpen:Se,onToggleExcerpt:me,onReload:_,disabled:Te||S}):null,vn=S?Tt("div",{className:"wou-inline-rename",children:[V("input",{ref:fe,type:"text",className:"wou-inline-rename-input wou-topic",value:ve,maxLength:120,placeholder:I,disabled:ue.busy,onChange:M=>Re(M.target.value),onKeyDown:M=>{M.key==="Enter"&&(M.preventDefault(),ue.busy||Dt()),M.key==="Escape"&&(M.preventDefault(),pt())}}),Tt("div",{className:"wou-inline-rename-actions",children:[V("button",{type:"button",className:"wou-inline-rename-save",disabled:ue.busy,onClick:()=>Dt(),children:n.renameSave}),Tt("button",{type:"button",className:"wou-inline-rename-ai",disabled:ue.busy,"aria-busy":ue.busy,title:n.renameWithAiTip,onClick:()=>{kn()},children:[V(gn,{}),V("span",{children:ue.busy?n.renameWithAiBusy:n.renameWithAi})]}),V("button",{type:"button",onClick:()=>pt(),children:n.renameCancel}),V("span",{className:"wou-inline-rename-hint",children:n.renameKeyboardHint})]}),ue.error?V("p",{className:"wou-inline-rename-error",role:"alert",children:ue.error}):null]}):St?null:V("span",{className:"wou-topic",children:V(wo,{text:I,tokens:O})}),Tn=!s&&!Te?Tt("div",{className:"wou-menu-anchor",style:{position:"relative"},ref:U,children:[V("button",{type:"button",className:l?"wou-icon wou-icon-nested":"wou-icon","aria-label":l?n.menuMoreForAsk(qt):n.menuMore,"aria-expanded":z,"aria-haspopup":"menu",disabled:S||Le,onClick:()=>ne(M=>!M),children:"\u2026"}),V(ka,{open:z,onClose:()=>ne(!1),menuRef:P,anchorRef:U,quadrant:t.quadrant,tags:o,tagState:M=>Wr([t],M),showWhyHere:!!Y,hidePriority:!Xe,onRename:tt,onRenameWithAi:()=>{Qt()},onSnoozeTomorrow:()=>f(t,be.tomorrow),onSnoozeMonday:()=>f(t,be.nextMonday),onSnoozeWeek:()=>f(t,be.inWeek),onCustomSnooze:Ce,onToggleTag:(M,ze)=>$(t,M,ze),onNewTag:()=>xe(!0),onQuadrant:M=>h(t,M),onWhyHere:()=>me(M=>!M),onDismiss:()=>w(t),dismissLabel:n.notATask})]}):null;return Tt("div",{className:`wou-row${l?" wou-row-nested":""}${s?" wou-closed-row":""}${Te?" wou-row-pending":""}${z?" wou-row-menu-open":""}${S?" wou-row-rename-open":""}${Z&&!l?" wou-row-follow-selected":""}${Ct?" wou-row-active":""}`,"data-rename-open":S?"true":void 0,"data-wou-follow-key":l?void 0:t.chat_key,"data-wou-task-id":j&&!s?t.id:void 0,"aria-current":Ct?"true":void 0,tabIndex:j&&!s?-1:void 0,onClick:j&&!s?()=>j.activate(t):void 0,children:[s?null:V("input",{type:"checkbox","aria-label":n.markDone(I),disabled:d||Te||S,onChange:()=>{d||Te||S||m(t)}}),Tt("div",{className:"wou-row-body",children:[l?vn:Tt("div",{className:"wou-card-title-line",children:[V("div",{className:"wou-card-title-main",children:vn}),sn?V("span",{className:"wou-updated-at wou-muted",title:mt,children:sn}):null,!l&&!s&&!Lt?V(Sa,{task:t}):null,!s&&!S&&!j?V("span",{className:"wou-session-slot",children:it}):null,Tn]}),wt?V("button",{type:"button",className:`wou-ask wou-ask-toggle${St&&!S?" wou-ask-only":""}`,"aria-expanded":Ae,title:Ae?n.askHideDetails:n.askShowDetails,onClick:()=>je(M=>!M),children:V(wo,{text:t.ask,tokens:O})}):V("div",{className:`wou-ask${St&&!S?" wou-ask-only":""}`,children:V(wo,{text:t.ask,tokens:O})}),t.status==="expired"?V("p",{className:"wou-muted",children:n.statusExpired}):null,wt&&Ae?V("div",{className:"wou-task-context wou-task-context-open",children:wt}):null,p?V("div",{className:"wou-pending-label",role:"status",children:p}):Le?V("div",{className:"wou-pending-label",role:"status",children:n.renameWithAiPending}):null,Nt,Un,Se&&Y?V("blockquote",{className:"wou-source-excerpt",children:Y}):null,he?Tt("form",{className:"wou-snooze-form",onSubmit:M=>{M.preventDefault(),xn()},children:[Tt("label",{className:"wou-muted",children:[V("span",{className:"wou-snooze-form-label",children:n.snoozeCustomShort}),V("input",{type:"datetime-local",value:Ie,min:Oe,onChange:M=>{oe(M.target.value),le(null)}})]}),_e?V("p",{className:"wou-snooze-error",role:"alert",children:_e}):null,Tt("div",{className:"wou-snooze-actions",children:[V("button",{type:"submit",children:n.snoozeSubmit}),V("button",{type:"button",onClick:()=>{q(!1),le(null)},children:n.snoozeCancel})]})]}):null,!l&&So?Tt("div",{className:"wou-meta",children:[E?V("span",{className:"wou-agent-chip",children:t.agent}):null,s?null:V(Dn,{dueAt:t.due_at,now:B}),ln,V(Qo,{tags:ft}),s?it:null,s&&C?V("button",{type:"button",onClick:()=>C(t),children:n.reopen}):null]}):ft.length>0||t.due_at?Tt("div",{className:"wou-nested-meta",children:[V(Dn,{dueAt:t.due_at,now:B}),V(Qo,{tags:ft}),s&&C?V("button",{type:"button",onClick:()=>C(t),children:n.reopen}):null]}):s&&C?V("div",{className:"wou-meta",children:s&&C?V("button",{type:"button",onClick:()=>C(t),children:n.reopen}):null}):null]}),l?Tn:null,V(mo,{open:we,onOpenChange:xe,createTag:v,applies:!0,onCreated:M=>$(t,M,"none")})]})}import{jsx as ee,jsxs as Ye}from"react/jsx-runtime";var bd="optionClickTipDismissed";function yd({ctx:e,group:t,tasks:o,allTags:a,nameAfterChat:s=!1,expanded:l,onToggleExpanded:c,pendingLabels:p,checkboxDisabled:d,groupPending:m,confirmClose:w,actionTasks:f,onConfirmClose:h,onCancelClose:$,onDoneAll:v,onDismissAll:x,onSnoozeAll:b,onMoveQuadrant:C,onToggleTag:_,onCreateTag:O,onProjectClick:Z,onRenameGroup:ce,onChildDone:te,onChildDismiss:E,onChildSnooze:K,onChildToggleTag:J,onChildRename:B,highlightTokens:j=[],followHighlighted:z=!1,forceExpanded:ne=!1,showProjectChips:Ae=!1,showPriorities:je=!0,showAgentChip:Se=!0,updatedNow:me=new Date,onReload:Y}){let he=ne||l,[q,S]=It(!1),[H,we]=It(!1),[xe,ve]=It(null),[Re,Ie]=It(!1),[oe,_e]=It(!1),le=Ta(e,{chat_key:t.chat_key}),[P,U]=It(!1),[fe,Te]=It(()=>!e.storage.get(bd,!1)),[I,ue]=It(!1),[Le,y]=It(""),[G,be]=It(()=>oo(new Date)),[Oe,Ce]=It(null),tt=zn(null),pt=zn(null),kn=zn(null),Qt=zn(null),Dt=zn(null),xn=zn(null),Xe=!!m,gt=Qc({pending:Xe,confirmClose:!!w,renameOpen:oe,aiQuick:P,customSnoozeOpen:Re,checkboxDisabled:d}),an=zn(!1),sn=A=>{we(!1),A&&(an.current=!0)};Fm(()=>{H||an.current&&(an.current=!1,Dt.current?.focus({preventScroll:!0}))},[H]);let mt=no(t,s),qe=f??o,St=Ae?ns(qe):[],Mt=ol(qe),qt=Dl(qe);or(()=>{if(!oe)return;let A=xn.current;A&&(A.focus(),A.select())},[oe]);let ln=(A,ye)=>{gt&&(S(!1),ve({x:A,y:ye}),we(!0))};or(()=>{gt||(S(!1),we(!1))},[gt]),or(()=>{if(!q&&!H)return;let A=ye=>{let lt=ye.target;pt.current?.contains(lt)||tt.current?.contains(lt)||Qt.current?.contains(lt)||kn.current?.contains(lt)||(S(!1),H&&sn(!0))};return document.addEventListener("pointerdown",A),()=>document.removeEventListener("pointerdown",A)},[q,H]),or(()=>{if(!q&&!H&&!Re&&!oe)return;let A=ye=>{ye.key==="Escape"&&(S(!1),H?sn(!0):we(!1),Ie(!1),oe&&(le.cancel(),_e(!1),y(mt)),Ce(null))};return document.addEventListener("keydown",A),()=>document.removeEventListener("keydown",A)},[q,H,Re,oe,mt]);let ft=async()=>{await on(e,t.chat_key,t.chat_title,t.chat_target,qe)},wt=en(new Date),So=Oo(Math.floor(Date.now()/1e3)),Lt=()=>{S(!1),be(oo(new Date)),Ce(null),Ie(!0)},Ct=()=>{S(!1),le.cancel(),U(!1),y(mt),_e(!0)},Nt=()=>{le.cancel(),_e(!1),y(mt)},it=async()=>{if(le.busy)return;let A=await le.generate();A&&(y(A),requestAnimationFrame(()=>{let ye=xn.current;ye&&(ye.focus(),ye.select())}))},Un=async()=>{if(S(!1),!le.busy){U(!0);try{let A=await le.generate();if(!A)return;if(((t.title_locked?t.title?.trim():"")||"")===A){ie(n.renameWithAiSame);return}ce(t,A)}finally{U(!1)}}};or(()=>{!P&&le.error&&!oe&&(de(n.renameWithAiFailed,le.error),le.setError(null))},[P,le.error,oe]);let vn=()=>{let A=Nl(Le,mt,t);if(A.action==="close"){_e(!1);return}_e(!1),ce(t,A.value??null)},Tn=()=>{let A=Br(G),ye=Math.floor(Date.now()/1e3);if(A==null||A<=ye){Ce(n.snoozePast);return}Ie(!1),Ce(null),b(A)},M=We(t.chat_key,t.chat_target).kind==="not-a-chat",ze=M?ee(ha,{agent:t.agent,onClick:()=>{ft()}}):ee(wa,{onClick:()=>{ft()}}),Vt=qi(qe),Co=Ur(Vt,me),nt=Gr(Vt),pr=oe?ee("input",{ref:xn,type:"text",className:"wou-inline-rename-input wou-group-title",value:Le,maxLength:120,placeholder:mt,disabled:le.busy,onChange:A=>y(A.target.value),onKeyDown:A=>{A.key==="Enter"&&(A.preventDefault(),le.busy||vn()),A.key==="Escape"&&(A.preventDefault(),Nt())}}):Ye("span",{className:"wou-group-title",children:[ee(wo,{text:mt,tokens:j}),he?null:ee("span",{className:"wou-group-count-pill",children:n.groupAsksCount(qe.length)})]}),He=gt?Ye("div",{style:{position:"relative"},ref:pt,children:[ee("button",{type:"button",className:"wou-icon","aria-label":n.menuMore,"aria-expanded":q,"aria-haspopup":"menu",disabled:oe||P,onClick:()=>{we(!1),S(A=>!A)},children:"\u2026"}),ee(ka,{open:q,onClose:()=>S(!1),menuRef:tt,anchorRef:pt,onCloseAll:()=>h(),onCloseAllNow:()=>v(),quadrant:t.quadrant,tags:a,tagState:A=>Wr(qe,A),showWhyHere:!1,hidePriority:!je,onRename:Ct,onRenameWithAi:()=>{Un()},onSnoozeTomorrow:()=>b(wt.tomorrow),onSnoozeMonday:()=>b(wt.nextMonday),onSnoozeWeek:()=>b(wt.inWeek),onCustomSnooze:Lt,onToggleTag:_,onNewTag:()=>ue(!0),onQuadrant:C,onWhyHere:()=>{},onDismiss:()=>x(),dismissLabel:n.notATaskAll})]}):null;return Ye("div",{className:`wou-group${Xe?" wou-row-pending":""}${z?" wou-group-follow-selected":""}`,"data-wou-follow-key":t.chat_key,children:[Ye("div",{ref:Dt,className:`wou-row wou-group-parent${oe?" wou-row-rename-open":""}${H||q?" wou-row-menu-open":""}`,"data-rename-open":oe?"true":void 0,tabIndex:gt?0:void 0,"aria-haspopup":gt?"menu":void 0,onContextMenu:A=>{let ye=A.target instanceof HTMLElement?A.target:null;Kc(ye)&&(A.preventDefault(),ln(A.clientX,A.clientY))},onKeyDown:A=>{if(!qc(A.key,A.shiftKey,A.target,A.currentTarget))return;A.preventDefault(),A.stopPropagation();let ye=Dt.current;if(!ye)return;let lt=ye.getBoundingClientRect();ln(lt.left+lt.width/2,lt.top+lt.height/2)},children:[ee("button",{type:"button",className:"wou-group-chevron-btn","aria-expanded":he,"aria-label":l?n.groupCollapse:n.groupExpand,title:n.groupChevronTip,onClick:A=>c(A.altKey),children:ee("span",{className:`wou-chevron${l?"":" wou-chevron-collapsed"}`,"aria-hidden":"true",children:"\u25BC"})}),Xe?ee("span",{className:"wou-group-checkbox-spacer","aria-hidden":"true"}):ee("input",{type:"checkbox","aria-label":n.markGroupDone(mt),title:n.groupCheckboxTip,disabled:d||!!w||oe,onClick:A=>{A.preventDefault(),A.altKey?v():h()},onChange:()=>{}}),Ye("div",{className:"wou-row-body",children:[Ye("div",{className:"wou-card-title-line wou-group-title-line",children:[ee("div",{className:"wou-card-title-main",children:pr}),!oe&&Co?ee("span",{className:"wou-updated-at wou-muted",title:nt,children:Co}):null,!oe&&!M&&o[0]?ee(Sa,{task:o[0]}):null,oe?null:ee("span",{className:"wou-session-slot",children:ze}),He]}),oe?Ye("div",{className:"wou-inline-rename-actions",children:[ee("button",{type:"button",className:"wou-inline-rename-save",disabled:le.busy,onClick:()=>vn(),children:n.renameSave}),Ye("button",{type:"button",className:"wou-inline-rename-ai",disabled:le.busy,"aria-busy":le.busy,title:n.renameWithAiTip,onClick:()=>{it()},children:[ee(gn,{}),ee("span",{children:le.busy?n.renameWithAiBusy:n.renameWithAi})]}),ee("button",{type:"button",onClick:()=>Nt(),children:n.renameCancel}),ee("span",{className:"wou-inline-rename-hint",children:n.renameKeyboardHint})]}):null,oe&&le.error?ee("p",{className:"wou-inline-rename-error",role:"alert",children:le.error}):null,P?ee("div",{className:"wou-pending-label",role:"status",children:n.renameWithAiPending}):null,!he&&!w&&!m&&!Re&&!oe?ee("p",{className:"wou-group-collapsed-preview",children:o[0]?.ask??""}):null,w?Ye("div",{className:"wou-group-confirm",role:"alertdialog","aria-label":n.markAllDone(qe.length),onKeyDown:A=>{A.key==="Escape"&&$()},children:[ee("p",{className:"wou-group-confirm-q",children:n.markAllDone(qe.length)}),Ye("div",{className:"wou-group-confirm-actions",children:[ee("button",{type:"button",className:"wou-group-confirm-yes",autoFocus:!0,onClick:()=>v(),children:n.markAllDoneYes(qe.length)}),ee("button",{type:"button",onClick:()=>$(),children:n.renameCancel})]}),fe?Ye("div",{className:"wou-group-confirm-hint",children:[ee("span",{children:n.groupOptionClickHint}),ee("button",{type:"button",className:"wou-tip-dismiss","aria-label":n.dismissTip,title:n.dismissTip,onClick:()=>{e.storage.set(bd,!0),Te(!1)},children:"\xD7"})]}):null]}):null,m?ee("div",{className:"wou-pending-label",role:"status",children:m}):null,Re?Ye("form",{className:"wou-snooze-form",onSubmit:A=>{A.preventDefault(),Tn()},children:[Ye("label",{className:"wou-muted",children:[ee("span",{className:"wou-snooze-form-label",children:n.snoozeCustomShort}),ee("input",{type:"datetime-local",value:G,min:So,onChange:A=>{be(A.target.value),Ce(null)}})]}),Oe?ee("p",{className:"wou-snooze-error",role:"alert",children:Oe}):null,Ye("div",{className:"wou-snooze-actions",children:[ee("button",{type:"submit",children:n.snoozeSubmit}),ee("button",{type:"button",onClick:()=>{Ie(!1),Ce(null)},children:n.snoozeCancel})]})]}):null,Se||qt!=null&&!he||St.length>0||Mt.length>0?Ye("div",{className:"wou-meta",children:[Se?ee("span",{className:"wou-agent-chip",children:t.agent}):null,he?null:ee(Dn,{dueAt:qt,now:me}),St.slice(0,2).map(A=>ee(ra,{project:A,onClick:Z},A.key)),St.length>2?Ye("span",{className:"wou-badge wou-project-chip",children:["+",St.length-2]}):null,ee(Qo,{tags:Mt})]}):null]}),ee("span",{ref:Qt,style:{position:"fixed",left:xe?.x??0,top:xe?.y??0,width:0,height:0,pointerEvents:"none"},"aria-hidden":"true"}),ee(Zc,{open:H&&gt,onClose:A=>sn(A==="escape"),menuRef:kn,anchorRef:Qt,onConfirmClose:()=>h(),onDoneAll:()=>v()})]}),he?ee("div",{className:"wou-group-children",children:o.map(A=>ee(yo,{ctx:e,task:A,allTags:a,nameAfterChat:s,nested:!0,groupTitle:mt,highlightTokens:j,pendingLabel:p[A.id],checkboxDisabled:d||!!p[A.id],onDone:te,onDismiss:E,onSnooze:K,onMoveQuadrant:()=>{},onToggleTag:J,onCreateTag:O,onRename:B,onReload:Y,showProjectChips:!1,showPriorities:je,updatedNow:me},A.id))}):null,ee(mo,{open:I,onOpenChange:ue,createTag:O,applies:!0,onCreated:A=>_(A,"none")})]})}import{jsx as rr,jsxs as kd}from"react/jsx-runtime";function xd({ctx:e,task:t,children:o,pendingLabel:a,disabled:s,onDone:l,onSnooze:c}){let p=va(),d=!!(s||a),w=We(t.chat_key,t.chat_target).kind==="not-a-chat"?n.handleWithAgent(t.agent):n.openSession;return kd("section",{className:"wou-next-up","aria-label":n.nextUpRegion,children:[rr("div",{className:"wou-next-up-kicker",children:rr("span",{children:n.nextUpKicker})}),o,a||p?null:kd("div",{className:"wou-next-up-actions",children:[rr("button",{type:"button",className:"wou-next-up-primary",disabled:d,onClick:()=>l(t),children:n.nextUpDone}),rr("button",{type:"button",disabled:d,onClick:()=>{on(e,t.chat_key,t.chat_title,t.chat_target,[t])},children:w}),rr("button",{type:"button",title:n.nextUpLaterTip,disabled:d,onClick:()=>c(t,en(new Date).tomorrow),children:n.nextUpLater})]})]})}function vd(e){let t=new Map,o=e.claims??new Set,a=!1,s=!1,l=()=>{if(a||s)return;let p=[...t.values()].find(h=>h.phase==="waiting"&&h.due);if(!p)return;a=!0,p.phase="sending",e.onChange();let{item:d,signal:m}=p,w=h=>{if(t.delete(d.taskId),o.delete(d.taskId),a=!1,s){h==="sent"&&e.onSent(d);return}h==="sent"?e.onSent(d):e.onFailed(d,h),e.onChange(),l()},f=!1;try{f=e.isStillOpen(d.taskId)}catch{f=!1}if(!f){w("gone");return}e.deliver(d,m).then(h=>w(h?"sent":"not-delivered"),()=>w("error"))},c=p=>{e.clearTimer(p.timer),t.delete(p.item.taskId),o.delete(p.item.taskId),e.onChange()};return{enqueue(p){if(s||t.has(p.taskId)||o.has(p.taskId))return!1;o.add(p.taskId);let d={item:p,phase:"waiting",due:!1,timer:null,signal:{aborted:!1}};return d.timer=e.setTimer(()=>{d.due=!0,l()},e.delayMs),t.set(p.taskId,d),e.onChange(),!0},cancel(p){let d=t.get(p);return!d||d.phase!=="waiting"?!1:(c(d),!0)},cancelLatest(){let p=[...t.values()].filter(m=>m.phase==="waiting"),d=p[p.length-1];return d?(c(d),d.item):null},cancelOutOfScope(p){let d=0;for(let m of[...t.values()])er(m.item.scope,p)||(m.phase==="waiting"?(c(m),e.onFailed(m.item,"not-delivered"),d++):m.phase==="sending"&&!m.signal.aborted&&(m.signal.aborted=!0,d++));return d&&l(),d},phase:p=>t.get(p)?.phase??null,get:p=>t.get(p)?.item??null,size:()=>t.size,dispose(){s=!0;for(let[p,d]of[...t])d.phase==="waiting"?(e.clearTimer(d.timer),t.delete(p),o.delete(p)):d.signal.aborted=!0}}}function Td(e,t,o){if(e.scope!==t.scope||e.seq!==t.seq)return null;let a="project_id"in o?o.project_id:void 0;return typeof a=="string"&&a!==t.scope?null:o}function Sd(e,t){if(e.scope!=="group"||!Array.isArray(t))return e;let o=new Set(t);return o.size===0?null:e.patches.every(a=>o.has(a.task.id))?e:{...e,tasks:e.tasks.filter(a=>o.has(a.id)),patches:e.patches.filter(a=>o.has(a.task.id))}}var Cd=1e4,Pa=1500,Nd=600,Pd=20,Ad=null,_d=null,$d=null;function qs(e){Ad=e}function Ed(){Ad?.()}function Vs(e){_d=e}function Rd(){_d?.()}function Ys(e){$d=e}function Id(){$d?.()}var Dd=null;function Xs(e){Dd=e}function Md(){Dd?.()}var Qs=null,Na=!1;function Zs(e){Qs=e,e&&Na&&(Na=!1,e())}function Ld(){Qs?(Na=!1,Qs()):Na=!0}import{host as ar,useValue as zd}from"@hermes/plugin-sdk";import{useCallback as Hm,useEffect as Hd,useRef as Bd,useState as bn,useSyncExternalStore as Bm}from"react";import{useEffect as jm,useRef as zm}from"react";var Od=[2e3,5e3,1e4,3e4];function Fd(e){let t=Math.min(Math.max(e,0),Od.length-1);return Od[t]}function jd(e,t,o){return e?!0:t!==!0?!1:o}function ko(e,t){let o=zm(e);o.current=e,jm(()=>{if(t)return;let a=!1,s=0,l,c=async()=>{if(a)return;let p=await o.current();if(a||p)return;let d=Fd(s);s+=1,l=setTimeout(()=>{c()},d)};return c(),()=>{a=!0,l!==void 0&&clearTimeout(l)}},[t,e])}var Ud=In,Um=3e4;function Gd(e,t=!0){let o=zd(ar.state.profile),a=ar.state.focusedSessionProfile?zd(ar.state.focusedSessionProfile):o,s=Bm(tn,Ke,Ke),[l,c]=bn([]),[p,d]=bn([]),[m,w]=bn({}),[f,h]=bn(null),[$,v]=bn(!1),[x,b]=bn(!0),C=Bd(0),_=Bd(0),[O,Z]=bn(!1),[ce,te]=bn(!1),E=Hm(async K=>{if(!Ke())return!1;let J=++C.current;try{let B=await Vr(e,$);return J!==C.current||(c(B.tasks),d(B.groups??[]),w(B.counts),h(B.last_scan),_.current=0,Z(!1),te(!0)),!0}catch(B){return J!==C.current?!1:mn(B)?(Uo(!1),!1):(_.current+=1,K?.userAction?de(n.loadError):_.current>=3&&Z(!0),!1)}finally{J===C.current&&b(!1)}},[e,$]);return Hd(()=>{if(!s){c([]),d([]),w({}),Z(!1),te(!0),b(!1);return}te(!1),b(!0),E()},[E,o,a,s]),ko(E,ce),Hd(()=>{let K=[],J=()=>{E()};e.onEvent?K.push(e.onEvent(Ud,J)):ar.onEvent&&K.push(ar.onEvent(Ud,J)),e.addEventListener&&typeof window<"u"&&K.push(e.addEventListener(window,jo,J));let j=setInterval(()=>{t&&s&&E()},Um);return K.push(()=>clearInterval(j)),()=>{for(let z of K)z()}},[e,E,t,s]),{tasks:l,setTasks:c,groups:p,setGroups:d,counts:m,lastScan:f,loading:x,fetchSucceeded:ce,offline:O,includeClosed:$,setIncludeClosed:v,reload:E}}import{host as sr,useValue as ir}from"@hermes/plugin-sdk";import{useCallback as Wd,useEffect as Aa,useLayoutEffect as Kd,useMemo as Gm,useRef as lr,useState as Wm}from"react";var Qd=15;function qd({ctx:e,enabled:t,desktopPane:o,paneVisible:a,tasks:s,groups:l,agentFilter:c,projectFilter:p,tagFilter:d,searchActive:m,collapsed:w,expandedSections:f,groupExpanded:h,sections:$,flatDisplayEntries:v,scrollRef:x,onClearFilters:b,onCloseSearch:C,setCollapsed:_,setExpandedSections:O,setGroupExpanded:Z,persistGroupExpanded:ce,persistCollapsed:te,followExtraTasks:E,setFollowExtraTasks:K,takeQuietChat:J}){let B=sr.state.focusedStoredSessionId,j=sr.state.activeSessionId,z=sr.state.focusedSessionProfile,ne=sr.state.focusedSessionOwner,Ae=sr.state.connectionId,je=B?ir(B):null,Se=j?ir(j):null,me=z?ir(z):null,Y=ne?ir(ne):null,he=Ae?ir(Ae):null,q={sessionId:je??Se,profile:me,owner:Y},S=Rc(q),H=t&&o&&a&&S!=null,we=lr(null);Kd(()=>{we.current!==S&&(we.current=null)},[S]);let xe=Wd((Te,I)=>we.current===I?!0:J?.(Te)?(we.current=I,!0):!1,[J]),[ve,Re]=Wm(null),Ie=lr(null),oe=lr(null),_e=lr(null),le=lr(a);Aa(()=>{a&&!le.current&&(oe.current=null,_e.current=null),le.current=a},[a]);let P=Gm(()=>{let Te=new Map;for(let I of s)Te.set(I.id,I);for(let I of E)Te.set(I.id,I);return[...Te.values()]},[s,E]),U=H?Os(P,l,q):null;Aa(()=>{if(!H||!S){K([]);return}if(Os(s,l,q)){K([]);return}let I=q.sessionId;if(!I)return;let ue=!1;return ea(e,I,q.owner?.profile??q.profile??"default",q.owner,he).then(Le=>{if(ue)return;if(Le.kind!=="ok"||!Le.data.tracked){K([]);return}let y=Le.data.tasks.filter(G=>G.status!=="done"&&G.status!=="dismissed");K(y)}),()=>{ue=!0}},[H,S,e,s,l,q.sessionId,q.profile,q.owner,he,K]),Aa(()=>{if(!H){Re(null),Ie.current=null,oe.current=null,_e.current=null;return}S!==Ie.current&&(Ie.current=S,oe.current=null,_e.current=null),Re(U?.chatKey??null)},[H,S,U?.chatKey]);let fe=Wd(Te=>{if(!S||_e.current===S)return;let I=Dc(Te,$,{agentFilter:c,projectFilter:p,tagFilter:d,searchActive:m,collapsed:w,expandedSections:f,groupExpanded:h},Qd);(I.agentFilter!==void 0||I.projectFilter!==void 0||I.tagFilter!==void 0)&&b(),I.closeSearch&&C(),I.collapsed&&(_(I.collapsed),te(I.collapsed)),I.expandedSections&&O(I.expandedSections),I.groupExpanded&&(Z(I.groupExpanded),ce(I.groupExpanded)),_e.current=S},[S,$,v,c,p,d,m,w,f,h,b,C,_,O,Z,ce,te]);return Aa(()=>{!H||!U||!S||xe(U.chatKey,S)||_e.current!==S&&fe(U)},[H,U,S,fe,xe]),Kd(()=>{if(!H||!U||!S||!ve||oe.current===S||xe(U.chatKey,S)||!Mc(U,$,v,Qd,f,w))return;let I=x.current;if(!I)return;let ue=I.querySelector(`[data-wou-follow-key="${CSS.escape(ve)}"]`);if(!ue)return;let Le=I,y=ue.getBoundingClientRect(),G=Le.getBoundingClientRect(),be=y.top-G.top-G.height/2+y.height/2;Le.scrollTop+=be,oe.current=S},[H,U,S,ve,$,v,f,w,x,c,p,d,m,h,xe]),H?ve:null}import{useLayoutEffect as Vd,useMemo as Km,useState as Yd}from"react";function Xd(e,t,o){let[a,s]=Yd(null),[l,c]=Yd(()=>typeof document>"u"||document.visibilityState==="visible");return Vd(()=>{if(!o||typeof document>"u")return;let p=()=>c(document.visibilityState==="visible");return document.addEventListener("visibilitychange",p),()=>document.removeEventListener("visibilitychange",p)},[o]),Vd(()=>{if(!o)return;let p=t.current;if(!p)return;if(typeof IntersectionObserver>"u"){s(null);return}let d=new IntersectionObserver(m=>s(m.some(w=>w.isIntersecting)),{threshold:0});return d.observe(p),()=>d.disconnect()},[o,t,e]),Km(()=>o?jd(e,a,l):!0,[o,e,a,l])}import{Fragment as sp,jsx as R,jsxs as se}from"react/jsx-runtime";var qm=15,Jd=Ru,Vm=3e4;function Hn(e,t){if(mn(e)){lo()&&ie(n.notOnThisProfile);return}if(io(e)){ie(n.alreadyCleared),t&&t();return}de(De(e).error||n.patchError)}var ep="sortOrder",ei="sectionCollapsed",ti="agentFilter",xo="projectFilter",_a="tagFilter",tp="filtersOpen",$a="groupExpanded",np="answerBarsAll",ip=8e3,Ym=200,Xm=ip+2e3,Zm=new Set;function op(e){if(!e)return[];let t=[];for(let o of e.querySelectorAll("[data-wou-task-id]")){if(o.offsetParent===null&&o.getClientRects().length===0)continue;let a=Number(o.dataset.wouTaskId);Number.isFinite(a)&&!t.includes(a)&&t.push(a)}return t}function Jm(e,t){return e?.querySelector(`[data-wou-task-id="${t}"]`)??null}function ef(e,t=40){let o=e.trim().replace(/\s+/g," ");return o.length>t?`${o.slice(0,t-1).trimEnd()}\u2026`:o}var tf={1:n.section1,2:n.section2,3:n.section3,4:n.section4};function rp(e,t){return bt(e).some(o=>o.id===t.id)?e:{...e,tags:[...bt(e),{id:t.id,name:t.name,color:t.color,source:"manual"}]}}function ap(e,t){return bt(e).some(o=>o.id===t)?{...e,tags:bt(e).filter(o=>o.id!==t)}:e}function ni({ctx:e,variant:t,hostPaneVisible:o=!0,onHidePane:a}){let s=Js(Qe.state.profile),l=Qe.state.focusedSessionProfile?Js(Qe.state.focusedSessionProfile):s,c=Js(Qe.state.connectionId),p=t==="pane",d=Me(null),m=Xd(o,d,p),{tasks:w,setTasks:f,groups:h,lastScan:$,includeClosed:v,setIncludeClosed:x,reload:b,offline:C,fetchSucceeded:_}=Gd(e,m),O=Qm(tn,Ke,Ke),[Z,ce]=Q(!1),[te,E]=Q([]),[K,J]=Q(!1),[B,j]=Q({}),[z,ne]=Q({}),[Ae,je]=Q(null),[Se,me]=Q(()=>e.storage.get($a,{})),[Y,he]=Q(!1),[q,S]=Q(()=>new Date),[H,we]=Q(()=>e.storage.get(tp,!1)===!0),xe=()=>{we(i=>(e.storage.set(tp,!i),!i))},[ve,Re]=Q(()=>e.storage.get(ep,"newest")),[Ie,oe]=Q(()=>e.storage.get(ei,{})),[_e,le]=Q({}),[P,U]=Q(null),[fe,Te]=Q(!1),[I,ue]=Q(!1),[Le,y]=Q(null),[G,be]=Q(!1),[Oe,Ce]=Q(!1),[tt,pt]=Q(()=>Uu(e.storage)),[kn,Qt]=Q("checking"),[Dt,xn]=Q(!1),Xe=P?.settings.consented===!0;Ee(()=>{if(!Xe||Z||Oe){Qt("checking");return}if(!$&&!Dt&&!G||tt&&!G)return;let i=!0;return zo(e,1).then(u=>{i&&Qt(u.length>0?"ready":"empty")}).catch(()=>{i&&Qt("error")}),()=>{i=!1}},[e,Xe,Z,Oe,$,Dt,w,G,tt]);let gt=i=>{ia(e.storage,i)&&pt(!0)},an=i=>{i&&ia(e.storage,"session",1)&&pt(!0),b()},sn=i=>{ia(e.storage,"session",i)&&pt(!0),Ce(!1),be(!1),b()},[mt,qe]=Q(!1),[St,Mt]=Q(null),[qt,ln]=Q(!1),[ft,wt]=Q(!1),[So,Lt]=Q(null),[Ct,Nt]=Q(null),[it,Un]=Q([]),[vn,Tn]=Q(0),[M,ze]=Q([]),[Vt,Co]=Q(!1),[nt,pr]=Q(()=>e.storage.get(ti,"all")),[He,A]=Q(()=>Xi(e.storage.get(xo,"all"))),[ye,lt]=Q(()=>Ji(e.storage.get(_a,[]))),[Sn,ii]=Q(!1),[gr,Ra]=Q(""),[Ia,li]=Q(""),[Da,Ma]=Q(""),[Gn,yp]=Q(!1),[ui,La]=Q([]),mr=Me(!1),ci=Me(null),Wn=Me(null),Kn=Me(new Map),Qn=Me(new Map),di=Me(new Map),[fr,kp]=Q(()=>e.storage.get(np,!1)===!0),pi=Me(fr);pi.current=fr;let[wr,No]=Q(null),[gi,xp]=Q(null),[vp,mi]=Q(0),Ot=Me(null),hr=Me(new Map),br=Me(null),Tp=W(i=>{let u=hr.current.get(i);return u==null||(hr.current.delete(i),u<Date.now())?!1:(br.current=i,!0)},[]),ot=W(async()=>{qe(!0);try{let i=await $n(e);return U(i),Mt(null),!0}catch{return Mt(n.settingsLoadError),!1}finally{qe(!1)}},[e]),Yt=Me({scope:0,seq:0}),fi=Me({ctx:e,profile:s,focusedProfile:l,connectionId:c}),Pt=W(async()=>{let i=String(Yt.current.scope),u=++Yt.current.seq,g={scope:i,seq:u};wt(!1),Lt(null);try{let k=await Zl(e),T=Td(g,{scope:String(Yt.current.scope),seq:Yt.current.seq},k);return T?(Un(T.projects),Tn(T.no_project_count),ln(!0),wt(!0),Lt(null),!0):!1}catch{return g.scope!==String(Yt.current.scope)||g.seq!==Yt.current.seq||(wt(!1),Lt(n.projectsLoadError)),!1}},[e,s,l,c]),Ve=W(async()=>{try{return ze(await Jl(e)),Co(!0),!0}catch{return!1}},[e]);Ee(()=>{U(null),Mt(null),Co(!1)},[e]),Zd(()=>{let i=fi.current;return(i.ctx!==e||i.profile!==s||i.focusedProfile!==l||i.connectionId!==c)&&(A("all"),e.storage.set(xo,"all")),fi.current={ctx:e,profile:s,focusedProfile:l,connectionId:c},Yt.current={scope:Yt.current.scope+1,seq:0},Un([]),Tn(0),y(null),ln(!1),wt(!1),Lt(null),()=>{Yt.current.scope+=1}},[e,s,l,c]),ko(ot,P!==null),ko(Pt,qt),Ee(()=>{let i=()=>{Pt()},u=[];return e.onEvent?u.push(e.onEvent(In,i)):Qe.onEvent&&u.push(Qe.onEvent(In,i)),e.addEventListener&&typeof window<"u"&&u.push(e.addEventListener(window,jo,i)),()=>{for(let g of u)g()}},[e,Pt]),ko(Ve,Vt),Ee(()=>{qt&&A(i=>{let u=Zi(i,it.map(g=>g.key));return u!==i&&e.storage.set(xo,u),u})},[e,it,qt]),Ee(()=>{Vt&&lt(i=>{let u=el(i,M.map(g=>g.id));return u!==i&&e.storage.set(_a,u),u})},[e,M,Vt]);let Oa=W(()=>{ue(!1),Ce(!1),Te(!0),ot()},[ot]),Sp=W(()=>{ue(!1),Ce(!1),Te(i=>!i),ot()},[ot]),Po=W(()=>{ue(!1),Te(!1),be(!1),Ce(!0)},[]);Ee(()=>(Zs(Po),()=>Zs(null)),[Po]),Ee(()=>{let i=()=>{ot()},u=[];return e.onEvent?u.push(e.onEvent(Jd,i)):Qe.onEvent&&u.push(Qe.onEvent(Jd,i)),e.addEventListener&&typeof window<"u"&&u.push(e.addEventListener(window,ds,i)),()=>{for(let g of u)g()}},[e,ot]),Ee(()=>{if(!m)return;let i=setInterval(()=>{ot(),Pt(),Ve()},Vm);return()=>clearInterval(i)},[m,ot,Pt,Ve]),Ee(()=>{let i=setInterval(()=>S(new Date),3e4);return()=>clearInterval(i)},[]),Ee(()=>{if(te.length===0){J(!1);return}J(!0);let i=setTimeout(()=>J(!1),Cd);return()=>clearTimeout(i)},[te]);let[yr,Cp]=Q([]),Xt=Fe(()=>w.filter(i=>i.status==="open"||i.status==="snoozed"),[w]),kr=Fe(()=>({consented:Xe,projectsFetchSucceeded:ft,tasksFetchSucceeded:_,offline:C,projects:it,projectKey:Le}),[Xe,ft,_,C,it,Le]),qn=Fe(()=>I?sc(Xt,kr):[],[I,Xt,kr]),Fa=Me(I);Fa.current=I;let wi=Me(qn);wi.current=qn;let hi=Me(kr);hi.current=kr;let bi=Me(Xt);bi.current=Xt;let rt=Fe(()=>{if(yr.length===0)return Xt;let i=new Map(Xt.map(u=>[u.id,u]));for(let u of yr)i.set(u.id,u);return[...i.values()]},[Xt,yr]),yi=Fe(()=>rs(rt,nt,He,ye),[rt,nt,He,ye]),ki=Fe(()=>w.filter(Xa),[w]),ja=Fe(()=>Ki(yi,h,ve),[yi,h,ve]);Ee(()=>{let i=window.setTimeout(()=>{Ma(gr),li(gr)},150);return()=>window.clearTimeout(i)},[gr]),Ee(()=>{if(!Gn){mr.current=!1,La([]);return}mr.current||(mr.current=!0,Vr(e,!0).then(i=>{La(i.tasks.filter(Xa))}).catch(()=>{mr.current=!1}))},[Gn,e]),Ee(()=>{if(!Sn)return;let i=window.requestAnimationFrame(()=>ci.current?.focus());return()=>window.cancelAnimationFrame(i)},[Sn]);let Be=p&&Sn&&!I,un=Fe(()=>Be?hl(Da):[],[Be,Da]),za=Be&&un.length>0?un:[],cn=P?.settings.name_after_chat??!1,xr=ro(P?.settings.group_by,P?.settings.show_priorities),vr=xr!=="none",xi=P?.settings.show_project_badges??!0,Ha=Qr(P?.settings.layout),vi=Fe(()=>Pl(rt),[rt]),Vn=Fe(()=>{if(!Be)return ja;let i={1:[],2:[],3:[],4:[]};for(let u of[1,2,3,4])i[u]=yl(ja[u],un,void 0,cn);return i},[Be,ja,un,cn]),Yn=Fe(()=>Vi(Vn,ve),[Vn,ve]),Ao=Fe(()=>xr==="priority"?Rl(Vn,tf):xr==="project"?El(Yn,n.sectionNoProject):null,[xr,Vn,Yn]),Xn=Fe(()=>Ha==="focus"&&!Be?Al(Ao,Yn):null,[Ha,Be,Ao,Yn]),Ba=Xn?.task.id??null,Tr=Fe(()=>!Be||!Gn?[]:rs(ui,nt,He,ye).filter(u=>jr(u,un,{nameAfterChat:cn})),[Be,Gn,ui,nt,He,ye,un,cn]),Np=Fe(()=>{let i=0;for(let u of[1,2,3,4])i+=Za(Vn[u]);return i},[Vn]),_o=W(()=>{ii(!1),Ra(""),li(""),Ma("")},[]),Ua=W(()=>{Ra(Ia),Ma(Ia),ii(!0)},[Ia]),$o=Fe(()=>{if(nt==="all"&&He==="all"&&ye.length===0)return null;let i=[];if(nt!=="all"&&i.push(nt),He!=="all"){let u=He.map(g=>g==="none"?n.projectFilterNone:it.find(k=>k.key===g)?.name??n.projectFilterMany(1));i.push(u.join(", "))}return ye.length>0&&i.push(ye.map(u=>M.find(g=>g.id===u)?.name??"").filter(Boolean).join(" + ")),i.filter(Boolean).join(" \xB7 ")},[nt,He,ye,it,M]),Sr=Fe(()=>xi&&nl(He),[xi,He]),Pp=Fe(()=>ll(rt),[rt]),Ap=Fe(()=>as(rt),[rt]),Ti=W(i=>f(u=>u.filter(g=>g.id!==i)),[f]),Si=W(i=>{let u=new Set(i);f(g=>g.filter(k=>!u.has(k.id)))},[f]),Eo=W(i=>{let u=Qn.current.get(i);u&&(clearTimeout(u),Qn.current.delete(i))},[]),Cr=W((i,u)=>{Eo(i);let g=(di.current.get(i)??0)+1;di.current.set(i,g),ne(T=>hc(T,i,u,g));let k=setTimeout(()=>{Qn.current.delete(i),ne(T=>bc(T,i,g))},Pa);return Qn.current.set(i,k),g},[Eo]),Nr=W((i,u,g)=>{ne(k=>yc(k,i,u,g))},[]),Pr=W((i,u)=>{Eo(i),ne(g=>kc(g,i,u))},[Eo]);Ee(()=>()=>{for(let i of Qn.current.values())clearTimeout(i);Qn.current.clear()},[]);let ht=W(i=>{let u=Kn.current.get(i);u&&(clearTimeout(u),Kn.current.delete(i))},[]),Zt=W(i=>{ht(i),j(u=>{if(!(i in u))return u;let g={...u};return delete g[i],g})},[ht]),Zn=W(()=>{he(!0),window.setTimeout(()=>he(!1),Nd)},[]),at=W(i=>{E(u=>[...u.slice(-(Pd-1)),i])},[]),At=W(()=>{E(i=>i.length===0?i:i.slice(0,-1))},[]),Ci=W(i=>{ht(i);let u=setTimeout(()=>{Kn.current.delete(i),Ti(i),Zt(i)},Pa);Kn.current.set(i,u)},[ht,Ti,Zt]),Ar=W(i=>{for(let u of i){ht(u);let g=setTimeout(()=>{Kn.current.delete(u),Si(i),Zt(u)},Pa);Kn.current.set(u,g)}},[ht,Si,Zt]),Ro=W(async(i,u,g,k,T)=>{if(!B[i.id]){T?.keepVisible||Zn(),k&&j(D=>({...D,[i.id]:k})),at(g),T?.keepVisible||Ci(i.id);try{(await zt(e,i.id,u)).chat_archived&&u.status==="done"&&j(F=>({...F,[i.id]:n.pendingDoneChatArchived})),b()}catch(D){ht(i.id),Zt(i.id),At(),Hn(D,b)}}},[e,B,Zn,at,Ci,ht,Zt,At,b]),Cn=i=>{Ro(i,{status:"done"},{scope:"task",task:i,kind:"done",message:n.undoDone,patch:{status:"open"}},n.pendingDone)},_r=i=>{Ro(i,{status:"dismissed"},{scope:"task",task:i,kind:"dismissed",message:n.undoDismissed,patch:{status:"open"}},n.pendingDismissed)},Nn=(i,u)=>{Ro(i,{snooze_until:u},{scope:"task",task:i,kind:"snooze",message:n.undoSnoozed,patch:{snooze_until:null}},`Snoozed until ${Ja(u)}`)},Ga=(i,u)=>{Ro(i,{quadrant:u},{scope:"task",task:i,kind:"quadrant",message:n.undoMoved,patch:{quadrant:i.quadrant,quadrant_locked:!!i.quadrant_locked,restore:!0}},`Moved to ${Hr(u)}`)},$r=(i,u)=>{let g=rt.filter(T=>T.chat_key===i.chat_key).length<2,k=i.title_override??(g?i.chat_name??null:null);Ro(i,{title:u},{scope:"task",task:i,kind:"rename",message:n.undoRename,patch:{title:k}},"",{keepVisible:!0})},_p=W(async(i,u)=>{let g=rt.filter(T=>T.chat_key===i.chat_key),k=i.title_locked&&i.title?.trim()||null;at({scope:"group",tasks:g,kind:"rename",message:n.undoRename,patches:[],groupRestore:{chat_key:i.chat_key,patch:{title:k}}});try{await jt(e,i.chat_key,{title:u}),b()}catch(T){At(),Hn(T,b)}},[e,rt,at,At,b]),Er=W((i,u,g)=>{let k=new Set(i);f(T=>T.map(D=>k.has(D.id)?g?rp(D,u):ap(D,u.id):D))},[f]),Rr=W(async(i,u,g)=>{let k=g!=="all";Er([i.id],u,k),at({scope:"tags",kind:"tags",message:n.undoTags,restore:[{taskId:i.id,add:k?[]:[u.id],remove:k?[u.id]:[]}]});try{await xs(e,i.id,k?{add:[u.id]}:{remove:[u.id]}),b(),Ve()}catch(T){At(),Hn(T,b),b()}},[e,Er,at,At,b,Ve]),$p=W(async(i,u,g)=>{if(i.length===0)return;let k=i[0].chat_key,T=g!=="all",D=L=>bt(L).some(ke=>ke.id===u.id),F=i.filter(L=>T?!D(L):D(L));Er(i.map(L=>L.id),u,T),at({scope:"tags",kind:"tags",message:n.undoGroupTags,restore:F.map(L=>({taskId:L.id,add:T?[]:[u.id],remove:T?[u.id]:[]}))});try{await jt(e,k,{task_ids:F.map(L=>L.id),...T?{tags_add:[u.id]}:{tags_remove:[u.id]}}),b(),Ve()}catch(L){At(),Hn(L,b),b()}},[e,Er,at,At,b,Ve]),Io=W(async(i,u)=>{let g=await ks(e,{name:i,color:u});return ze(k=>k.some(T=>T.id===g.id)?k:[...k,g]),Ve(),g},[e,Ve]),Ni=W(async i=>{let u=await ks(e,i.hint?i:{name:i.name,color:i.color});return ze(g=>g.some(k=>k.id===u.id)?g:[...g,u]),Ve(),u},[e,Ve]),Ep=W(async(i,u)=>{try{let g=await eu(e,i,u);return ze(k=>k.map(T=>T.id===i?{...T,...g}:T)),b(),!0}catch(g){return de(De(g).error||n.tagSaveError),!1}},[e,b]),Rp=W(async i=>{if(window.confirm(n.tagDeleteConfirm(i.name)))try{await tu(e,i.id),ze(u=>u.filter(g=>g.id!==i.id)),Ve(),b()}catch(u){de(De(u).error||n.tagSaveError)}},[e,Ve,b]),Pi=W(i=>{let u=[i.key];A(u),e.storage.set(xo,u),Wn.current?.scrollTo({top:0})},[e]),Do=W(i=>Se[i]!==!1,[Se]),Ip=W((i,u=!1)=>{let g=!Do(i),k=u?{...Se,...Object.fromEntries(h.map(T=>[T.chat_key,g])),[i]:g}:{...Se,[i]:g};me(k),e.storage.set($a,k)},[e,Se,Do,h]),Ai=W(()=>{let u=!h.some(k=>Do(k.chat_key)),g={...Se,...Object.fromEntries(h.map(k=>[k.chat_key,u]))};me(g),e.storage.set($a,g)},[e,Se,h,Do]),_i=W(async(i,u,g,k)=>{let T=i[0].chat_key,D=i.map(L=>L.id);if(D.some(L=>B[L]))return;Zn(),j(L=>{let ke={...L};for(let Ue of D)ke[Ue]=k;return ke});let F=Cr(T,k);Ar(D);try{let L=await jt(e,T,{status:u,task_ids:D}),ke=Sd(g,L.closed_task_ids);ke&&at(ke),L.already_closed&&ie(n.alreadyCleared);let Ue=L.chat_archived&&u==="done"?n.pendingDoneChatArchived:void 0;Nr(T,F,Ue),b()}catch(L){for(let ke of D)ht(ke);j(ke=>{let Ue={...ke};for(let qa of D)delete Ue[qa];return Ue}),Pr(T,F),Hn(L,b)}},[B,Zn,at,Ar,e,b,ht,Cr,Nr,Pr]),Dp=W(async(i,u)=>{let g=i[0].chat_key,k=i.map(F=>F.id);if(k.some(F=>B[F]))return;Zn();let T=`Snoozed until ${Ja(u)}`;j(F=>{let L={...F};for(let ke of k)L[ke]=T;return L});let D=Cr(g,T);at({scope:"group",tasks:i,kind:"snooze",message:n.undoGroupSnoozed,patches:i.map(F=>({task:F,patch:{snooze_until:null}}))}),Ar(k);try{await Promise.all(i.map(F=>zt(e,F.id,{snooze_until:u}))),Nr(g,D),b()}catch(F){for(let L of k)ht(L);j(L=>{let ke={...L};for(let Ue of k)delete ke[Ue];return ke}),Pr(g,D),At(),Hn(F,b)}},[B,Zn,at,Ar,e,b,ht,At,Cr,Nr,Pr]),Mp=W(async(i,u,g)=>{let k=i[0].chat_key;try{let T=await jt(e,k,{quadrant:g});T.priority_restore&&at({scope:"group",tasks:i,kind:"quadrant",message:n.undoGroupMoved,patches:[],groupRestore:{chat_key:k,patch:{priority_restore:T.priority_restore}}}),b()}catch(T){Hn(T,b)}},[e,b,at,At]),$i=async i=>{try{await zt(e,i.id,{status:"open"}),La(u=>u.filter(g=>g.id!==i.id)),b()}catch{de(n.patchError)}},Mo=W(async()=>{if(Ot.current?.cancelLatest()){ie(n.answerCancelled);return}let u=te[te.length-1];if(u){if(E(g=>g.slice(0,-1)),u.scope==="tags"){let g=new Map(M.map(k=>[k.id,k]));f(k=>k.map(T=>{let D=u.restore.find(L=>L.taskId===T.id);if(!D)return T;let F=T;for(let L of D.remove)F=ap(F,L);for(let L of D.add){let ke=g.get(L);ke&&(F=rp(F,ke))}return F}));try{await Promise.all(u.restore.map(k=>xs(e,k.taskId,{add:k.add,remove:k.remove}))),b(),Ve()}catch{de(n.patchError),b()}return}if(u.scope==="group"){let g=u.tasks[0]?.chat_key;for(let k of u.tasks)Zt(k.id);g&&(Eo(g),ne(k=>{if(!(g in k))return k;let T={...k};return delete T[g],T})),f(k=>{let T=new Set(k.map(F=>F.id)),D=[...k];for(let F of u.tasks)T.has(F.id)||D.push(F);return D.sort((F,L)=>F.id-L.id)});try{u.groupRestore&&await jt(e,u.groupRestore.chat_key,u.groupRestore.patch),u.patches.length>0&&await Promise.all(u.patches.map(k=>zt(e,k.task.id,k.patch))),b()}catch{de(n.patchError)}return}Zt(u.task.id),f(g=>g.some(k=>k.id===u.task.id)?g:[...g,u.task].sort((k,T)=>k.id-T.id));try{await zt(e,u.task.id,u.patch),b()}catch{de(n.patchError)}}},[te,Zt,f,e,b,M,Ve]);Ee(()=>(qs(()=>{Mo()}),()=>qs(null)),[Mo]),Ee(()=>{let i=d.current;if(!i||!p)return;let u=g=>{if((g.metaKey||g.ctrlKey)&&g.key==="f"){let T=g.target;if(!T||!i.contains(T))return;g.preventDefault(),Ua();return}if(!(g.metaKey||g.ctrlKey)||g.key!=="z"||g.shiftKey)return;let k=g.target;!k||!i.contains(k)||k.tagName==="INPUT"||k.tagName==="TEXTAREA"||k.isContentEditable||(g.preventDefault(),Mo())};return i.addEventListener("keydown",u),()=>i.removeEventListener("keydown",u)},[Mo,p,Ua]);let Ei=W(i=>{if(i.skipped==="consent"){Nt(null),ot();return}if(i.skipped==="off"){Nt("off");return}if(i.capped){Nt("capped");return}if(i.skipped==="locked"){Nt("locked"),b(),Pt();return}if(Nt(null),!i.skipped){let u=fc(i);if(u)de(u);else{let g=i.added??0,k=i.resolved??0;ie(n.scanDone(g,k,i.expired??0))}}b(),Pt(),ot()},[ot,Pt,b]);Ee(()=>{if(Ct!=="capped"||P==null)return;let i=P.settings.daily_call_cap;(i<=0||P.usage.today.calls<i)&&Nt(null)},[Ct,P]);let Jn=W(async(i=!1)=>{if(!Z){ce(!0);try{let u=await nu(e,i?{force:!0}:void 0);!u.skipped&&!u.capped&&xn(!0),Ei(u)}catch(u){let g=u;g?.status===429||String(g?.message??"").includes("429")?ie(n.scanRateLimited):de(n.scanFailed)}finally{ce(!1)}}},[e,Z,Ei]),Lp=()=>{Jn(!1)};Ee(()=>(Vs(()=>{Jn(!1)}),()=>Vs(null)),[Jn]),Ee(()=>(Ys(Ai),()=>Ys(null)),[Ai]);let Op=async()=>{try{let i=await En(e,{consented:!0});U(u=>u?{...u,settings:i.settings}:{settings:i.settings,usage:{today:{calls:0,prompt_tokens:0,completion_tokens:0},history:[]},model:{provider:null,model:null,label:"your main Hermes model"}}),p&&be(!0),await Jn(!1)}catch{de(n.patchError)}},Fp=i=>{Re(i),e.storage.set(ep,i)},jp=i=>{let u={...Ie,[i]:!Ie[i]};oe(u),e.storage.set(ei,u)},Ri=t==="page"?"wou-page":"wou-pane",Jt=p&&P!=null&&!P.settings.consented,Ii=P?.settings,zp=P!=null&&ml(P.usage.today.calls,P.settings.daily_call_cap),Di=Ii?gl(Ii.mode):null,Mi=$?.at,Ir=Mi!=null?Yi(Mi,q):"",Li=Ir?`${n.updatedPrefix} ${Ir}`:null,eo=fe||Oe||G||I,Dr=nt!=="all"||He!=="all"||ye.length>0,Mr=W(()=>{pr("all"),A("all"),lt([]),e.storage.set(ti,"all"),e.storage.set(xo,"all"),e.storage.set(_a,[])},[e]),Hp=W(i=>e.storage.set(ei,i),[e]),Bp=W(i=>e.storage.set($a,i),[e]),dn=qd({ctx:e,enabled:!I&&(P?.settings.follow_selected_chat??!0),desktopPane:p,paneVisible:m,tasks:Xt,groups:h,agentFilter:nt,projectFilter:He,tagFilter:ye,searchActive:Be,collapsed:Ie,expandedSections:_e,groupExpanded:Se,sections:Ao,flatDisplayEntries:Yn,scrollRef:Wn,onClearFilters:Mr,onCloseSearch:_o,setCollapsed:oe,setExpandedSections:le,setGroupExpanded:me,persistGroupExpanded:Bp,persistCollapsed:Hp,followExtraTasks:yr,setFollowExtraTasks:Cp,takeQuietChat:Tp}),to=Fe(()=>Us(Qe),[]),Lr=Me(rt);Lr.current=rt;let Oi=Me(Cn);Oi.current=Cn;let Wa=Me(Nn);Wa.current=Nn;let Ka=Me(wr);Ka.current=wr;let Ft=W(()=>{let i=Qe.state.connectionId?.get()??null,g=Qe.state.focusedSessionOwner?.get()?.profile??Qe.state.focusedSessionProfile?.get()??null;return ud(i,g)},[]);Ee(()=>{let i=Qe.state.connectionId;if(!i)return;let u=Qe.state.focusedSessionOwner,g=Qe.state.focusedSessionProfile,k=Ft(),T=()=>{let F=Ft();er(k,F)||(k=F,mi(L=>L+1),Ot.current?.cancelOutOfScope(F))},D=[i,u,g].filter(F=>!!F).map(F=>F.subscribe(T));return()=>D.forEach(F=>F())},[Ft]),Ee(()=>{let i=vd({delayMs:rd,setTimer:(u,g)=>window.setTimeout(u,g),clearTimer:u=>window.clearTimeout(u),isStillOpen:u=>Lr.current.some(g=>g.id===u&&g.status==="open"),claims:Zm,deliver:async(u,g)=>{let k=d.current,T=document.activeElement,D=!!(k&&T&&k.contains(T)),F=!1,L=()=>{F=!0},ke=pn=>{pn.key==="Tab"&&(F=!0)};window.addEventListener("pointerdown",L,!0),window.addEventListener("keydown",ke,!0);let Ue=()=>{if(!D||!k||F||g.aborted)return;let pn=document.activeElement;if(pn&&k.contains(pn))return;(T&&T.isConnected?T:k).focus({preventScroll:!0})},qa=Qe.composer,Wp=Qe.state?.focusedStoredSessionId;try{return await cd({composer:qa,shownSessionId:()=>Wp?.get()??null,inScope:()=>er(u.scope,Ft()),openInPlace:async pn=>{hr.current.set(u.chatKey,Date.now()+Xm),await Uc(pn),window.requestAnimationFrame(Ue)},sleep:pn=>new Promise(Ui=>window.setTimeout(Ui,pn)),timeoutMs:ip,pollMs:Ym,signal:g},u.sessionId,u.text)}finally{hr.current.delete(u.chatKey),window.removeEventListener("pointerdown",L,!0),window.removeEventListener("keydown",ke,!0),window.requestAnimationFrame(Ue)}},onSent:u=>{ie(n.answerSent(u.label,u.chatTitle));let g=Lr.current.find(k=>k.id===u.taskId);g&&g.status==="open"&&Oi.current(g)},onFailed:(u,g)=>{g==="gone"?ie(n.answerGone(u.chatTitle)):de(n.answerNotSent(u.chatTitle),`answer ${g} task=${u.taskId}`)},onChange:()=>mi(u=>u+1)});return Ot.current=i,()=>{i.dispose(),Ot.current===i&&(Ot.current=null)}},[Ft]);let Or=W((i,u)=>{let g=Wn.current,k=Fa.current?wi.current:op(g),T=id(k,u,i);if(T==null)return;No(T);let D=Jm(g,T);D&&(D.scrollIntoView({block:"nearest"}),D.focus({preventScroll:!0}))},[]),Fr=W((i,u,g)=>{let k=Ot.current;if(!k||!tr(i,to,Ft())||nr(i)||u!=="reply"&&!Jo(i.ask))return;let T=We(i.chat_key,i.chat_target);if(T.kind!=="main")return;let D=ad(u,i.ask,g);if(!D)return;let F=u==="yes"?n.answerYes:u==="no"?n.answerNo:ef(g??""),L=i.chat_title?.trim()||i.topic?.trim()||n.pluginName;if(!k.enqueue({taskId:i.id,sessionId:T.sessionId,chatKey:i.chat_key,scope:Ft(),text:D,label:F,chatTitle:L})){ie(n.answerAlreadyPending);return}Ka.current===i.id&&Or(1,i.id)},[to,Or,Ft]),Up=Fe(()=>({activeId:wr,showAll:fr,canSubmit:to&&Ft().profile==="default",replyRequest:gi,phase:i=>Ot.current?.phase(i)??null,answerLabel:i=>Ot.current?.get(i)?.label??null,activate:i=>No(i.id),answer:Fr,cancel:i=>{Ot.current?.cancel(i.id)&&ie(n.answerCancelled)},later:i=>Wa.current(i,en(new Date).tomorrow),open:i=>{on(e,i.chat_key,i.chat_title,i.chat_target,[i])}}),[wr,fr,to,gi,Fr,e,vp]),Fi=Me([]);Zd(()=>{let i=Wn.current,u=I?qn:op(i),g=Fi.current;Fi.current=u,No(k=>{let T=ld(g,u,k);if(T!=null)return T;if(u.length===0)return null;if(I)return u[0];if(dn){let D=i?.querySelector(`[data-wou-follow-key="${CSS.escape(dn)}"]`),F=D?.dataset.wouTaskId?D:D?.querySelector("[data-wou-task-id]"),L=F?Number(F.dataset.wouTaskId):NaN;if(u.includes(L))return L}return u[0]})}),Ee(()=>{I&&No(i=>i!=null&&qn.includes(i)?i:qn[0]??null)},[I,Le,qn]),Ee(()=>{if(I)return;if(!dn){br.current=null;return}if(br.current===dn)return;br.current=null;let u=Wn.current?.querySelector(`[data-wou-follow-key="${CSS.escape(dn)}"]`),g=u?.dataset.wouTaskId?u:u?.querySelector("[data-wou-task-id]"),k=g?Number(g.dataset.wouTaskId):NaN;Number.isFinite(k)&&No(k)},[dn]),Ee(()=>(Xs(()=>{let i=!pi.current;kp(i),e.storage.set(np,i),ie(i?n.answerBarsAllOn:n.answerBarsAllOff)}),()=>Xs(null)),[e]);let ji=(!eo||I)&&!v&&Xe;Ee(()=>{let i=d.current;if(!i||!ji)return;let u=g=>{if(g.defaultPrevented||g.isComposing)return;let k=g.target;if(!k||!i.contains(k)||k.closest('[role="menu"], [role="dialog"]'))return;let T=k.tagName==="INPUT"||k.tagName==="TEXTAREA"||k.tagName==="SELECT"||k.isContentEditable,D=sd({key:g.key,metaKey:g.metaKey,ctrlKey:g.ctrlKey,altKey:g.altKey,shiftKey:g.shiftKey,typing:T});if(!D)return;let F=Ka.current;if(D==="next"||D==="prev"){g.preventDefault(),Or(D==="next"?1:-1,F);return}let L=Fa.current?ic(bi.current,hi.current,F):Lr.current.find(Ue=>Ue.id===F);if(!L||Ot.current?.phase(L.id))return;let ke=tr(L,to,Ft());if(D==="yes"||D==="no"){if(!ke||!Jo(L.ask))return;g.preventDefault(),Fr(L,D)}else if(D==="reply"){if(!ke)return;g.preventDefault(),xp(Ue=>({taskId:L.id,n:(Ue?.n??0)+1}))}else if(D==="later"){if(L.status!=="open")return;g.preventDefault(),Wa.current(L,en(new Date).tomorrow)}else D==="open"&&(g.preventDefault(),on(e,L.chat_key,L.chat_title,L.chat_target,[L]))};return i.addEventListener("keydown",u),()=>i.removeEventListener("keydown",u)},[ji,to,Fr,Or,e]);let zi=te[te.length-1],Hi=te.length>1?te.length-1:0,Gp=Be&&un.length>0&&Np===0&&Tr.length===0,Qa=(i,u=!1,g=!1)=>R(yo,{defaultDetailsOpen:u,inNextUp:u,ctx:e,task:i,allTags:M,nameAfterChat:cn,pendingLabel:B[i.id],checkboxDisabled:Y||!!B[i.id],onDone:Cn,onDismiss:_r,onSnooze:Nn,onMoveQuadrant:Ga,onToggleTag:(k,T,D)=>{Rr(k,T,D)},onCreateTag:Io,onProjectClick:Pi,onRename:$r,onReload:()=>{b()},highlightTokens:za,followHighlighted:dn===i.chat_key,showProjectChips:Sr,showPriorities:vr&&!g,showAgentChip:vi,updatedNow:q},u?`next-up-${i.id}`:i.id),Bi=i=>{if(i.kind==="task")return i.task.id===Ba?null:Qa(i.task);let{group:u}=i,g=i.tasks,k=Ba==null?i.tasks:i.tasks.filter(T=>T.id!==Ba);return k.length===0?null:R(yd,{ctx:e,group:u,tasks:k,allTags:M,nameAfterChat:cn,expanded:Do(u.chat_key),forceExpanded:Be&&un.length>0,highlightTokens:za,followHighlighted:dn===u.chat_key,onToggleExpanded:T=>Ip(u.chat_key,T),pendingLabels:B,checkboxDisabled:Y,groupPending:xc(z,u.chat_key),confirmClose:Ae===u.chat_key,actionTasks:g,onConfirmClose:()=>je(u.chat_key),onCancelClose:()=>je(null),onDoneAll:()=>{je(null),_i(g,"done",{scope:"group",tasks:g,kind:"done",message:n.undoGroupDone,patches:g.map(T=>({task:T,patch:{status:"open"}}))},n.pendingDone)},onDismissAll:()=>{_i(g,"dismissed",{scope:"group",tasks:g,kind:"dismissed",message:n.undoGroupDismissed,patches:g.map(T=>({task:T,patch:{status:"open"}}))},n.pendingDismissed)},onSnoozeAll:T=>{Dp(g,T)},onMoveQuadrant:T=>{Mp(g,u.quadrant,T)},onToggleTag:(T,D)=>{$p(g,T,D)},onCreateTag:Io,onProjectClick:Pi,onRenameGroup:(T,D)=>{_p(T,D)},onChildDone:Cn,onChildDismiss:_r,onChildSnooze:Nn,onChildToggleTag:(T,D,F)=>{Rr(T,D,F)},onChildRename:$r,onReload:()=>{b()},showProjectChips:Sr,showPriorities:vr,showAgentChip:vi,updatedNow:q},u.chat_key)};return O?R(Gs.Provider,{value:Up,children:R(Hc,{children:se("div",{className:`${r} wou-layout-${Ha}`,ref:d,tabIndex:-1,children:[R("style",{children:Rn}),se("div",{className:Ri,children:[se("header",{className:"wou-header",children:[se("div",{className:"wou-header-row1",children:[R("h1",{className:"wou-title",children:n.pluginName}),Li?R("span",{className:"wou-header-updated wou-muted",children:Li}):null,C?R("span",{className:"wou-header-status wou-muted",role:"status",children:n.offline}):null,Di?R("span",{className:"wou-header-status wou-muted",children:Di}):null,zp?R("span",{className:"wou-header-status wou-muted",children:n.headerDailyLimit}):null,se("div",{className:"wou-header-actions",children:[Xe&&!fe&&!Oe&&!G?R("button",{type:"button",className:"wou-link","aria-pressed":I,onClick:()=>{I||(y(He==="all"||He.length!==1||He[0]==="none"?null:He[0]),x(!1),_o(),Pt()),ue(i=>!i)},children:"Catch up"}):null,p&&!I?R("button",{type:"button",className:"wou-icon-btn",onClick:()=>Ua(),"aria-label":n.searchOpen,title:n.searchOpen,children:R(mu,{})}):null,!v&&!Jt&&!eo&&!Sn?R("button",{type:"button",className:`wou-icon-btn wou-filter-btn${Dr||ve!=="newest"?" wou-filter-btn-on":""}`,onClick:xe,"aria-expanded":H,"aria-controls":"wou-filter-row","aria-label":Dr?n.filtersButtonActive:n.filtersButton,title:Dr?n.filtersButtonActive:n.filtersButton,children:R(Cu,{})}):null,R("button",{type:"button",className:"wou-icon-btn",onClick:()=>{Lp()},disabled:Z,"aria-busy":Z,"aria-label":n.scanNow,title:n.scanNow,children:R(Xr,{className:Z?"wou-icon-spin":void 0})}),R("button",{type:"button",className:"wou-icon-btn",onClick:()=>Sp(),"aria-label":n.settings,"aria-pressed":fe,title:n.settings,children:R(Su,{})}),p&&a?R("button",{type:"button",className:"wou-icon-btn",onClick:a,"aria-label":n.hidePaneHeader,title:n.hidePaneHeader,children:R(Tu,{})}):null]})]}),Ct==="capped"&&!Z?se("div",{className:"wou-scan-banner",role:"status",children:[R("span",{children:n.scanCapped}),R("button",{type:"button",className:"wou-link",onClick:()=>{Jn(!0)},children:n.scanAnyway})]}):null,Ct==="locked"&&!Z?se("div",{className:"wou-scan-banner",role:"status",children:[R("span",{children:n.scanLocked}),R("button",{type:"button",className:"wou-link",onClick:()=>{Jn(!0)},children:n.scanTryAgain})]}):null,Ct==="off"?se("div",{className:"wou-scan-banner",role:"status",children:[R("span",{children:n.scanUpdatesOff}),R("button",{type:"button",className:"wou-link",onClick:()=>Oa(),children:n.settings})]}):null,C||Jt?null:pc($?.errors).map(i=>se("div",{className:"wou-scan-banner wou-scan-banner-warn",role:"status",children:[R("span",{children:wc(i)}),R("button",{type:"button",className:"wou-link",onClick:()=>Oa(),children:n.settings})]},i.name)),C||Jt?null:gc($?.errors).map(i=>R("div",{className:"wou-scan-banner wou-scan-banner-warn",role:"status",children:mc(i)},i.name??"default")),Z?R("p",{className:"wou-muted wou-scan-banner",role:"status",children:n.scanningHint}):null,!Jt&&!eo&&Sn?se("div",{className:"wou-search-row",children:[se("div",{className:"wou-search-row-main",children:[R("input",{ref:ci,type:"search",className:"wou-search-input",value:gr,onChange:i=>Ra(i.target.value),placeholder:n.searchPlaceholder,"aria-label":n.searchAria,onKeyDown:i=>{i.key==="Escape"&&(i.preventDefault(),_o())}}),se("label",{className:"wou-search-include",children:[R("input",{type:"checkbox",checked:Gn,onChange:i=>yp(i.target.checked)}),n.searchIncludeClosed]}),R("button",{type:"button",className:"wou-icon-btn wou-search-close",onClick:()=>_o(),"aria-label":n.searchClose,title:n.searchClose,children:"\xD7"})]}),$o?se("p",{className:"wou-search-filtered wou-muted",children:[se("span",{children:[n.searchFilteredPrefix," ",$o]}),R("button",{type:"button",className:"wou-link",onClick:Mr,children:n.clearFilters})]}):null]}):null,!v&&!Jt&&!eo&&!Sn&&!H&&$o?se("p",{className:"wou-filter-summary wou-muted",children:[se("button",{type:"button",className:"wou-link wou-filter-summary-text",onClick:xe,title:$o,children:[n.filtersSummary,": ",$o]}),R("button",{type:"button",className:"wou-link wou-clear-filters",onClick:Mr,children:n.clearFilters})]}):null,!v&&!Jt&&!eo&&!Sn&&H?se("div",{className:"wou-header-row2",id:"wou-filter-row",children:[se("select",{className:"wou-select",value:nt==="all"?"all":nt,onChange:i=>{let u=i.target.value,g=u==="all"?"all":u;pr(g),e.storage.set(ti,g)},"aria-label":n.agentFilterLabel,title:n.agentFilterLabel,children:[R("option",{value:"all",children:sl(Ap)}),Pp.map(({agent:i,counts:u})=>R("option",{value:i,children:il(i,u)},i))]}),R(Sc,{filter:He,projects:it,noProjectCount:vn,onOpen:()=>{Pt()},onChange:i=>{A(i),e.storage.set(xo,i)}}),R(Cc,{filter:ye,tags:M,onOpen:()=>{Ve()},onChange:i=>{lt(i),e.storage.set(_a,i)}}),se("select",{className:"wou-select",value:ve,onChange:i=>Fp(i.target.value),"aria-label":n.sortLabel,title:n.sortLabel,children:[R("option",{value:"newest",children:n.sortNewest}),R("option",{value:"oldest",children:n.sortOldest})]}),Dr?R("button",{type:"button",className:"wou-link wou-clear-filters",onClick:Mr,children:n.clearFilters}):null]}):null]}),se("div",{className:"wou-scroll",ref:Wn,children:[Gu({desktop:p,consented:Xe,scanned:$!=null||Dt,availability:kn,resolved:tt,onboarding:G,settings:fe||I,teaching:Oe,searching:Be,closed:v})?se("aside",{className:"wou-teach-prompt","aria-labelledby":"wou-teach-prompt-title",children:[R("button",{type:"button",className:"wou-icon-btn wou-teach-prompt-close","aria-label":n.teachCardDismiss,onClick:()=>gt("dismiss"),children:"\xD7"}),R("h2",{id:"wou-teach-prompt-title",children:n.teachCardTitle}),R("p",{className:"wou-muted",children:n.teachCardIntro}),se("div",{className:"wou-teach-prompt-actions",children:[R("button",{type:"button",className:"wou-btn-compact",onClick:Po,children:n.teachCardStart}),R("button",{type:"button",className:"wou-link",onClick:()=>gt("not-now"),children:n.teachCardNotNow})]})]}):null,fe&&P?R(rc,{ctx:e,bundle:P,tags:M,onCreateTag:Io,onPatchTag:Ep,onDeleteTag:i=>{Rp(i)},onAddSuggestedTag:Ni,onBundleChange:U,onOpenTeach:Po,onBack:()=>{Te(!1),ot()}}):fe?se("div",{className:"wou-settings-loading",role:"status",children:[R("p",{className:"wou-muted",children:n.settingsLoading}),St?se("p",{children:[St," ",R("button",{type:"button",className:"wou-link",onClick:()=>{ot()},children:n.retry})]}):null]}):Oe?R(dc,{ctx:e,now:q,scanning:Z,onBack:sn,onAnswered:an}):G&&!Jt?R(Qu,{ctx:e,tags:M,scanning:Z,teachAvailability:kn,onAddTag:Ni,onTeachNow:Po,onFinish:()=>be(!1)}):Jt&&P?R(Ku,{settings:P.settings,model:P.model,scanning:Z,onStart:()=>{Op()},onChangeSettings:()=>Oa()}):I&&Xe?R(lc,{projects:it,projectKey:Le,onProjectChange:y,tasks:Xt,ready:qt&&ft&&_,offline:C,consented:Xe,projectsFetchSucceeded:ft,tasksFetchSucceeded:_,projectsError:So,onRetryProjects:()=>{Pt()},renderTask:Qa,onBack:()=>ue(!1)}):v?R("section",{className:"wou-section",children:ki.length===0?R("p",{className:"wou-muted",children:n.sectionEmpty}):ki.map(i=>R(yo,{ctx:e,task:i,allTags:M,nameAfterChat:cn,closed:!0,showProjectChips:Sr,showPriorities:vr,updatedNow:q,onDone:Cn,onDismiss:_r,onSnooze:Nn,onMoveQuadrant:Ga,onToggleTag:(u,g,k)=>{Rr(u,g,k)},onCreateTag:Io,onRename:$r,onReopen:$i,onReload:()=>{b()}},i.id))}):Gp?se("div",{className:"wou-search-empty",children:[R("p",{children:n.searchNoMatch(Da.trim())}),R("button",{type:"button",className:"wou-link",onClick:()=>_o(),children:n.searchClear})]}):rt.length===0&&!Be?se("div",{className:"wou-list-empty",children:[R("p",{children:n.listEmpty}),Ir?R("p",{className:"wou-muted",children:n.listEmptyScan(Ir)}):null]}):se(sp,{children:[Xn?R(xd,{ctx:e,task:Xn.task,pendingLabel:B[Xn.task.id],disabled:Y,onDone:Cn,onSnooze:Nn,children:Qa(Xn.task,!0,Xn.group!=null)}):null,Ao==null?R("section",{className:"wou-section wou-flat-list",children:Yn.map(i=>Bi(i))}):Ao.map(({key:i,title:u,entries:g})=>{let k=Za(g);if(Be&&k===0)return null;let T=Be&&k>0?!1:!!Ie[i],D=_e[i],F=Be||D?g:g.slice(0,qm),L=g.length-F.length,ke=`wou-sec-${i.replace(/[^a-zA-Z0-9_-]/g,"_")}`;return se("section",{className:"wou-section","aria-labelledby":ke,children:[se("button",{type:"button",id:ke,className:"wou-section-heading","aria-expanded":!T,onClick:()=>jp(i),children:[R("span",{className:`wou-chevron${T?" wou-chevron-collapsed":""}`,"aria-hidden":"true",children:"\u25BC"}),se("span",{children:[u," (",ss(g),")"]})]}),T?null:k===0?R("p",{className:"wou-muted",children:n.sectionEmpty}):se(sp,{children:[F.map(Ue=>Bi(Ue)),!Be&&!D&&L>0?R("button",{type:"button",className:"wou-link wou-show-all",onClick:()=>le(Ue=>({...Ue,[i]:!0})),children:al(g)}):null]})]},i)}),Be&&Gn?se("section",{className:"wou-section","aria-labelledby":"wou-sec-closed",children:[R("div",{className:"wou-section-heading",id:"wou-sec-closed",children:se("span",{children:[n.searchClosedSection," (",Tr.length,")"]})}),Tr.length===0?R("p",{className:"wou-muted",children:n.sectionEmpty}):Tr.map(i=>R(yo,{ctx:e,task:i,allTags:M,nameAfterChat:cn,closed:!0,highlightTokens:za,onDone:Cn,onDismiss:_r,onSnooze:Nn,onMoveQuadrant:Ga,onToggleTag:(u,g,k)=>{Rr(u,g,k)},onCreateTag:Io,onRename:$r,onReopen:$i,onReload:()=>{b()},showProjectChips:Sr,showPriorities:vr,updatedNow:q},i.id))]}):null]}),!Jt&&!eo?se("footer",{className:"wou-footer",children:[se("label",{style:{display:"flex",alignItems:"center",gap:8},children:[R("input",{type:"checkbox",checked:v,onChange:i=>x(i.target.checked),"aria-label":v?n.hideClosed:n.showClosed}),v?n.hideClosed:n.showClosed]}),R("p",{className:"wou-muted",style:{margin:"8px 0 0"},children:n.closedNote})]}):null,K&&zi?se("div",{className:"wou-undo",role:"status",children:[se("span",{children:[zi.message,Hi>0?` ${n.undoMore(Hi)}`:""]}),R("button",{type:"button",onClick:()=>{Mo()},children:n.undo})]}):null]})]})]})})}):t==="pane"?null:se("div",{className:r,ref:d,children:[R("style",{children:Rn}),R("div",{className:Ri,children:R("p",{className:"wou-muted",children:n.notOnThisProfile})})]})}function lp({registered:e,visible:t,hasActiveSession:o}){return e&&t?"hide":!o&&!(e&&t)?"navigate":e&&!t?"reveal":"show"}var oi=!1,ri=new Set;function ur(){return oi}function vo(e){if(oi!==e){oi=e;for(let t of ri)t()}}function up(e){return ri.add(e),()=>ri.delete(e)}import{jsx as rn}from"react/jsx-runtime";var Pe=ut,To=`${Pe}:tasks`,Ea="paneHidden",nf={display:"inline-flex",alignItems:"center",justifyContent:"center",height:"100%",padding:"0 6px",fontSize:"0.6875rem",color:"var(--ui-text-tertiary)",background:"transparent",border:"none",cursor:"pointer"},Kt=null,Bn=null,dr=!1,cr=null;function of(){return{id:"nav",area:"sidebar.nav",order:40,data:{path:"/waiting-on-you",label:n.pluginName,codicon:"checklist"}}}function mp(e){Bn||(Bn=e.register(of()))}function dp(e){Bn&&(Bn(),Bn=null),Kt&&(Kt(),Kt=null,vo(!1),dr=!0)}function rf(e){mp(e),dr&&(dr=!1,e.storage.get(Ea,!1)||si(e))}function yn(){return Ke()?!0:(ie(n.notOnThisProfile),!1)}function si(e){Kt||(Kt=e.register({id:"tasks",area:"panes",title:n.pluginName,data:{placement:"right",width:"420px",hideOnly:!0},render:()=>rn(uf,{ctx:e,onHidePane:()=>fp(e)})}),vo(!0))}function fp(e,t=!0){Kt&&(Kt(),Kt=null,vo(!1),e.storage.set(Ea,!0),t&&ie(n.paneHiddenNotify))}function wp(e){si(e),e.storage.set(Ea,!1),setTimeout(()=>et.revealPane(To),0)}function ai(e){if(!yn())return;let t=ur(),o=et.paneVisibility(To).get(),a=et.state.activeSessionId.get()!=null;switch(lp({registered:t,visible:o,hasActiveSession:a})){case"hide":fp(e);break;case"show":wp(e);break;case"reveal":et.revealPane(To);break;case"navigate":et.navigate("/waiting-on-you");break}}function pp(e){if(!yn())return;let t=ur(),o=et.state.activeSessionId.get()!=null;if(!t){o?wp(e):et.navigate("/waiting-on-you");return}o?et.revealPane(To):et.navigate("/waiting-on-you")}async function hp(e,t){if(yn())try{let o=await $n(e),a=t(Yr(o.settings));await En(e,{group_by:a}),ie(a==="none"?n.groupedByNone:a==="project"?n.groupedByProject:n.groupedByPriority)}catch{ie(n.patchError)}}async function af(e,t,o,a){if(yn())try{let l=!(await $n(e)).settings[t];await En(e,{[t]:l}),ie(l?o:a)}catch{ie(n.patchError)}}function bp(e,t){switch(t){case`${Pe}.open-keybind`:return()=>ai(e);case`${Pe}.undo`:return()=>{yn()&&Ed()};case`${Pe}.toggle-priorities`:return()=>{hp(e,_l)};case`${Pe}.toggle-project-badges`:return()=>{af(e,"show_project_badges",n.projectBadgesOn,n.projectBadgesOff)};case`${Pe}.toggle-groups`:return()=>{yn()&&Id()};case`${Pe}.toggle-answer-bars`:return()=>{yn()&&Md()};case`${Pe}.scan`:return()=>{yn()&&Rd()};default:return}}function sf(e,t){return bp(e,t)}function lf({ctx:e}){return rn(ni,{ctx:e,variant:"page"})}function uf({ctx:e,onHidePane:t}){let o=gp(et.paneVisibility(To));return rn(ni,{ctx:e,variant:"pane",hostPaneVisible:o,onHidePane:t})}function cf({onToggle:e}){let t=cp(tn,Ke,Ke),o=cp(up,ur,ur),a=gp(et.paneVisibility(To)),s=o&&a,l=s?n.statusBarHidePane:n.statusBarShowPane;return t?rn("button",{type:"button",onClick:e,title:l,"aria-label":l,"aria-pressed":s,style:nf,onMouseEnter:c=>{c.currentTarget.style.color="var(--foreground)",c.currentTarget.style.background="var(--chrome-action-hover)"},onMouseLeave:c=>{c.currentTarget.style.color="var(--ui-text-tertiary)",c.currentTarget.style.background="transparent"},children:rn("span",{style:{display:"inline-flex",width:14,height:14},children:rn(Zr,{})})}):null}var df={id:Pe,name:n.pluginName,defaultEnabled:!1,register(e){Kt=null,Bn=null,dr=!1,cr?.(),cr=null,e.onDispose(()=>{Kt=null,Bn=null,dr=!1,cr?.(),cr=null,vo(!1)}),e.storage.get(Ea,!1)?vo(!1):si(e);let o=Cs.flatMap(d=>{let m=bp(e,d.keybindId);if(!m)return[];let w=[{id:d.registerSlotId,area:"keybinds",data:{id:d.keybindId,label:d.keybindLabel,category:d.category,defaults:d.defaults,run:m}}];if(d.paletteLabel){let f=d.registerSlotId.replace(/-keybind$/,"-palette"),h=d.keybindId.replace(`${Pe}.`,"");w.push({id:f,area:"palette",data:{id:`${Pe}.${h.replace(/-keybind$/,"")}-palette`,action:`${Pe}.${h.replace(/-keybind$/,"")}`,label:d.paletteLabel,keywords:[...n.paletteKeywords],run:sf(e,d.keybindId)}})}return w}),a={[`${Pe}.undo-palette`]:["undo"],[`${Pe}.toggle-priorities-palette`]:["priorities","quadrant"],[`${Pe}.toggle-project-badges-palette`]:["project","badge"],[`${Pe}.toggle-groups-palette`]:["expand","collapse","groups"],[`${Pe}.toggle-answer-bars-palette`]:["answer","reply","yes","no","buttons"],[`${Pe}.scan-palette`]:["scan","refresh"]};for(let d of o){if(d.area!=="palette"||!d.data||!("keywords"in d.data))continue;let m=a[d.data.id];m&&(d.data.keywords=[...n.paletteKeywords,...m])}e.registerMany([{id:"page",area:"routes",title:n.pluginName,data:{path:"/waiting-on-you"},render:()=>rn(lf,{ctx:e})},{id:"palette-open",area:"palette",data:{id:`${Pe}.open`,action:`${Pe}.open`,label:n.paletteOpen,keywords:[...n.paletteKeywords],run:()=>pp(e)}},{id:"palette-toggle-panel",area:"palette",data:{id:`${Pe}.open-palette`,action:`${Pe}.open-keybind`,label:n.paletteTogglePanel,keywords:[...n.paletteKeywords,"show","hide","toggle","panel"],run:()=>ai(e)}},...o,{id:"palette-group-by-project",area:"palette",data:{id:`${Pe}.group-by-project-palette`,action:`${Pe}.group-by-project`,label:n.paletteGroupByProject,keywords:[...n.paletteKeywords,"group","project","sections"],run:()=>{hp(e,()=>"project")}}},{id:"palette-teach",area:"palette",data:{id:`${Pe}.teach-palette`,action:`${Pe}.teach`,label:n.paletteTeach,keywords:[...n.paletteKeywords,"teach","priorities","sort","quiz","train"],run:()=>{if(!Ke()){ie(n.notOnThisProfile);return}pp(e),Ld()}}},{id:"composer-button",area:"composer.actions",order:50,render:()=>rn(ju,{ctx:e})}]),e.register({id:"statusbar-toggle",area:"statusBar.right",order:90,render:()=>rn(cf,{onToggle:()=>ai(e)})}),mp(e),Ke()||dp(e);let s=d=>{d?rf(e):dp(e)},l=tn(()=>s(Ke())),c=()=>{typeof e.rest=="function"&&Au((d,m)=>e.rest(d,m))},p=Pu([et.state.profile,et.state.connectionId,et.state.focusedSessionProfile,et.state.focusedSessionOwner],c);cr=()=>{l(),p()},c()}},xx=df;export{To as PANE_ID,xx as default};
