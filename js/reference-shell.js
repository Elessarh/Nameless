/* Persistent reference header: real navigation, optional scenery/audio controls,
   and member-only announcements. No synthetic notification or player data. */
(function(global){
'use strict';
if(global.NamelessReferenceShell)return;
var sprite='/assets/ui/reference-icons.svg',emblem='/assets/brand/nameless-emblem-128.webp';
var menu=null,accountMenu=null,notifications=null,notificationGeneration=0,dialogId=0,indicatorFrame=0,accountCleared=false;
var closingPanels=new WeakMap();
var dialogOpeners=new WeakMap();
function reducedMotion(){return !!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
function cancelPanelClose(panel){var pending=closingPanels.get(panel);if(!pending)return;closingPanels.delete(panel);pending.animation.cancel();panel.removeAttribute('data-reference-closing');}
/* Keep the dialog and its focus trap alive through its exit; a new selection
   cancels the old exit before it can hide the new record or steal its focus. */
function closePanel(panel,finish){
if(!panel||closingPanels.has(panel))return;
var surface=panel.querySelector('.modal-content')||panel;
if(reducedMotion()||typeof surface.animate!=='function'){finish();return;}
var offset=panel.tagName==='DIALOG'||panel.dataset.panelMode==='sheet'?'translateY(16px)':'translateX(22px)';
var animation=surface.animate([{opacity:1,transform:'none'},{opacity:0,transform:offset}],{duration:160,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
var pending={animation:animation};closingPanels.set(panel,pending);panel.dataset.referenceClosing='true';
animation.finished.then(function(){if(closingPanels.get(panel)!==pending)return;closingPanels.delete(panel);panel.removeAttribute('data-reference-closing');if(panel.isConnected)finish();animation.cancel();},function(){});
}
function closeDialog(d){if(d.open)closePanel(d,function(){d.close();});}
function updateIndicator(link){
var nav=document.querySelector('.header .nav-menu');if(!nav)return;
if(global.innerWidth<=768){nav.dataset.referenceIndicator='false';return;}
var focused=document.activeElement?.closest?.('.header .nav-menu a');
var homeLink=global.location.pathname==='/'?Array.from(nav.querySelectorAll('a')).find(function(anchor){try{return new URL(anchor.href,document.baseURI).pathname==='/wiki';}catch(_){return false;}}):null;
link=link||(focused&&nav.contains(focused)?focused:null)||nav.querySelector('[aria-current="page"]')||homeLink;
if(!link||!nav.contains(link)){nav.dataset.referenceIndicator='false';return;}
var box=link.getBoundingClientRect(),base=nav.getBoundingClientRect();
if(!box.width){nav.dataset.referenceIndicator='false';return;}
nav.style.setProperty('--reference-nav-x',(box.left-base.left)+'px');nav.style.setProperty('--reference-nav-width',box.width+'px');nav.dataset.referenceIndicator='true';
}
function scheduleIndicator(){if(indicatorFrame)return;indicatorFrame=global.requestAnimationFrame(function(){indicatorFrame=0;updateIndicator();});}
function en(){return global.NamelessI18n&&global.NamelessI18n.getLanguage()==='en';}
function t(fr,english){return en()?english:fr;}
function icon(name){var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','reference-header-icon');svg.setAttribute('aria-hidden','true');var use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',sprite+'#icon-'+name);svg.appendChild(use);return svg;}
function el(tag,cls,text){var node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;}
function focusSignInAfterAuth(){global.requestAnimationFrame(function(){var login=document.querySelector('#login-link');if(accountCleared&&login?.isConnected&&global.getComputedStyle(login).display!=='none')login.focus();});}
function restoreFocus(d){var target=dialogOpeners.get(d);if(!target?.isConnected)return;if(target.matches('.reference-account-trigger')&&accountCleared){focusSignInAfterAuth();return;}if(target.matches('.reference-account-trigger')&&global.getComputedStyle(target.closest('#user-info')).display==='none')target=document.querySelector('#login-link');if(global.innerWidth<=768&&target.matches('.reference-settings-trigger'))target=document.querySelector('#hamburger');else if(global.innerWidth>768&&target.matches('.reference-mobile-settings'))target=document.querySelector('.reference-settings-trigger');else if(target.matches('.reference-mobile-settings')&&!document.querySelector('.nav-menu.active'))target=document.querySelector('#hamburger');target?.focus();}
function dialog(title){var d=el('dialog','reference-dialog nm-game-frame');d.dataset.i18nIgnore='';var head=el('div','reference-dialog-head');var h=el('h2','',title);h.id='reference-heading-'+(++dialogId);d.setAttribute('aria-labelledby',h.id);var close=el('button','reference-dialog-close','×');close.type='button';close.setAttribute('aria-label',t('Fermer','Close'));close.addEventListener('click',function(){closeDialog(d);});head.append(h,close);d.appendChild(head);d.addEventListener('click',function(event){if(event.target!==d)return;var rect=d.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog(d);});d.addEventListener('keydown',function(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeDialog(d);}});d.addEventListener('cancel',function(event){event.preventDefault();closeDialog(d);});d.addEventListener('close',function(){cancelPanelClose(d);restoreFocus(d);});document.body.appendChild(d);return d;}
function open(d,button){cancelPanelClose(d);if(d.open)return;dialogOpeners.set(d,button);if(d===menu)d.id='reference-navigation';else if(d===accountMenu)d.id='reference-account';else if(d===notifications)d.id='reference-announcements';button.setAttribute('aria-controls',d.id);button.setAttribute('aria-expanded','true');d.showModal();}
function renderMenu(){
if(!menu)menu=dialog(t('Ambiance et affichage','Ambience and display'));
menu.querySelector('h2').textContent=t('Ambiance et affichage','Ambience and display');
menu.querySelector('.reference-dialog-close').setAttribute('aria-label',t('Fermer','Close'));
var active=document.activeElement,focusedAction=menu.contains(active)?active.dataset.referenceAction:null;
var links=menu.querySelector('.reference-menu-links');if(links)links.remove();
var settings=menu.querySelector('.reference-preferences');if(settings)settings.remove();settings=el('div','reference-preferences');
var motion=el('button','',t('Animations du décor','Scenery animations'));motion.type='button';var homeButton=document.querySelector('[data-home-motion]');motion.disabled=!homeButton||homeButton.disabled;motion.textContent=homeButton?t(homeButton.getAttribute('aria-pressed')==='true'?'Animer le décor':'Pause du décor',homeButton.getAttribute('aria-pressed')==='true'?'Resume scenery':'Pause scenery'):t('Contrôle du décor disponible sur l’accueil','Scenery control is available on the homepage');motion.addEventListener('click',function(){var target=document.querySelector('[data-home-motion]');if(target)target.click();renderMenu();});settings.appendChild(motion);
motion.dataset.referenceAction='motion';
var audio=el('button','',t('Activer l’ambiance sonore','Enable ambient sound'));audio.type='button';audio.dataset.referenceAction='audio';var target=document.querySelector('.nm-audio-btn');audio.disabled=!target;audio.setAttribute('aria-pressed',target?target.getAttribute('aria-pressed')||'false':'false');if(target&&target.getAttribute('aria-pressed')==='true')audio.textContent=t('Couper l’ambiance sonore','Mute ambient sound');audio.addEventListener('click',function(){document.querySelector('.nm-audio-btn')?.click();renderMenu();});settings.appendChild(audio);menu.appendChild(settings);
if(focusedAction)menu.querySelector('[data-reference-action="'+focusedAction+'"]')?.focus();
}
function settingsIcon(){var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','reference-header-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');var path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M4 7h5m4 0h7M4 17h9m4 0h3M9 4v6m4 4v6');svg.appendChild(path);return svg;}
function renderAccount(){
if(!accountMenu)accountMenu=dialog(t('Votre compte','Your account'));
var active=document.activeElement,focusedHref=accountMenu.contains(active)?active.getAttribute('href'):null,focusedLogout=active.matches('.reference-account-logout');
accountMenu.querySelector('h2').textContent=t('Votre compte','Your account');
accountMenu.querySelector('.reference-dialog-close').setAttribute('aria-label',t('Fermer','Close'));
accountMenu.querySelector('.reference-account-content')?.remove();
var content=el('div','reference-account-content'),source=document.querySelector('#username');
var identity=el('div','reference-account-identity');var avatar=source?.querySelector('img');if(avatar)identity.appendChild(avatar.cloneNode(true));
identity.appendChild(el('strong','',source?.textContent||t('Joueur','Player')));content.appendChild(identity);
var links=el('nav','reference-menu-links');links.setAttribute('aria-label',t('Navigation du compte','Account navigation'));
[['/profil','user','Mon personnage','My character'],['/espace-guilde','guild','Quartier général','Headquarters']].forEach(function(row){var a=el('a','',t(row[2],row[3]));a.href=row[0];a.prepend(icon(row[1]));a.addEventListener('click',function(){accountMenu.close();});links.appendChild(a);});content.appendChild(links);
var logout=el('button','reference-account-logout',t('Se déconnecter','Sign out'));logout.type='button';logout.addEventListener('click',function(){accountMenu.close();document.querySelector('#logout-btn')?.click();});content.appendChild(logout);accountMenu.appendChild(content);
if(focusedHref)Array.from(links.querySelectorAll('a')).find(function(a){return a.getAttribute('href')===focusedHref;})?.focus();else if(focusedLogout)logout.focus();
}
function syncAccountButton(){var button=document.querySelector('.reference-account-trigger'),source=document.querySelector('#username');if(!button||!source)return;button.replaceChildren();var avatar=accountCleared?null:source.querySelector('img');button.appendChild(avatar?avatar.cloneNode(true):icon('user'));button.appendChild(el('span','',(!accountCleared&&source.textContent)||t('Joueur','Player')));button.appendChild(el('span','reference-account-chevron','⌄'));button.setAttribute('aria-label',t('Ouvrir le menu du compte','Open account menu'));}
async function renderNotifications(){
if(!notifications)notifications=dialog(t('Annonces de la guilde','Guild announcements'));notifications.querySelector('h2').textContent=t('Annonces de la guilde','Guild announcements');var previous=notifications.querySelector('.reference-notification-list');if(previous)previous.remove();var list=el('ul','reference-notification-list');notifications.appendChild(list);var generation=++notificationGeneration;
function note(message,href,caption){list.replaceChildren();var li=el('li');li.appendChild(el('p','',message));if(href){var a=el('a','',caption);a.href=href;a.addEventListener('click',function(){notifications.close();});li.appendChild(a);}list.appendChild(li);}
note(t('Chargement des annonces…','Loading announcements…'));
var db=global.supabase;
if(!db?.auth?.getUser){note(t('Connectez-vous pour consulter les annonces de votre guilde.','Sign in to read your guild announcements.'),'/connexion',t('Connexion','Sign in'));return;}
try{
var account=await db.auth.getUser();if(generation!==notificationGeneration)return;
if(account.error||!account.data?.user){note(t('Connectez-vous pour consulter les annonces de votre guilde.','Sign in to read your guild announcements.'),'/connexion',t('Connexion','Sign in'));return;}
var role=await db.rpc('current_user_role');if(generation!==notificationGeneration)return;
if(role.error||!['membre','admin'].includes(role.data)){note(t('Les annonces sont réservées aux membres de Nameless.','Announcements are available to Nameless members.'),'/espace-guilde',t('Voir la guilde','View the guild'));return;}
var response=await db.from('guild_activity_wall').select('*').order('created_at',{ascending:false}).limit(8);if(generation!==notificationGeneration)return;
if(response.error)throw response.error;
if(!response.data?.length){note(t('Aucune annonce publiée pour le moment.','No announcements have been published yet.'));return;}
list.replaceChildren();response.data.forEach(function(record){var li=el('li');var a=el('a','',record.titre||record.title||t('Annonce de la guilde','Guild announcement'));a.href='/espace-guilde';a.addEventListener('click',function(){notifications.close();});li.appendChild(a);var content=record.contenu||record.content||record.message||record.description;if(content)li.appendChild(el('p','',String(content).slice(0,260)));if(record.created_at){var time=el('time','',new Intl.DateTimeFormat(en()?'en-GB':'fr-FR',{dateStyle:'medium',timeZone:'Europe/Paris'}).format(new Date(record.created_at)));time.dateTime=record.created_at;li.appendChild(time);}list.appendChild(li);});
}catch(_){if(generation===notificationGeneration)note(t('Les annonces ne peuvent pas être chargées. Réessayez en ouvrant la fenêtre.','Announcements could not be loaded. Reopen this window to retry.'));}
}
function upgrade(){
var header=document.querySelector('.header'),nav=header?.querySelector('.nav-container');if(!nav)return;
var logo=nav.querySelector('.nav-logo-safe');if(logo){logo.src='/assets/brand/nameless-emblem-64.webp?v=20261009identity';logo.srcset='/assets/brand/nameless-emblem-64.webp?v=20261009identity 1x, '+emblem+'?v=20261009identity 2x';logo.width=48;logo.height=48;}
var wordmark=nav.querySelector('.nav-wordmark');if(wordmark&&!wordmark.querySelector('.nav-brand-caption'))wordmark.appendChild(el('span','nav-brand-caption','SAO France'));
var login=nav.querySelector('#login-link');if(login&&!login.querySelector('svg'))login.prepend(icon('user'));
if(!nav.querySelector('.reference-settings-trigger')){var settings=el('button','reference-settings-trigger');settings.type='button';settings.dataset.i18nIgnore='';settings.setAttribute('aria-haspopup','dialog');settings.setAttribute('aria-expanded','false');settings.appendChild(settingsIcon());settings.addEventListener('click',function(){renderMenu();open(menu,settings);});nav.insertBefore(settings,nav.querySelector('.nav-connexion'));}nav.querySelector('.reference-settings-trigger').setAttribute('aria-label',t('Ambiance et affichage','Ambience and display'));
var mobileNav=nav.querySelector('.nav-menu');if(mobileNav&&!mobileNav.querySelector('.reference-mobile-settings')){var item=el('li','reference-mobile-tools');var mobileSettings=el('button','reference-mobile-settings');mobileSettings.type='button';mobileSettings.dataset.i18nIgnore='';mobileSettings.setAttribute('aria-haspopup','dialog');mobileSettings.setAttribute('aria-expanded','false');mobileSettings.addEventListener('click',function(){renderMenu();open(menu,mobileSettings);});item.appendChild(mobileSettings);mobileNav.appendChild(item);}mobileNav?.querySelector('.reference-mobile-settings')?.replaceChildren(settingsIcon(),document.createTextNode(t('Ambiance et affichage','Ambience and display')));
var userInfo=nav.querySelector('#user-info');if(userInfo&&!userInfo.querySelector('.reference-account-trigger')){var account=el('button','reference-account-trigger');account.type='button';account.dataset.i18nIgnore='';account.setAttribute('aria-haspopup','dialog');account.setAttribute('aria-expanded','false');account.addEventListener('click',function(){renderAccount();open(accountMenu,account);});userInfo.prepend(account);var username=nav.querySelector('#username');if(username)new MutationObserver(syncAccountButton).observe(username,{childList:true,subtree:true,characterData:true});}syncAccountButton();
if(!nav.querySelector('.reference-notifications-trigger')){var bell=el('button','reference-notifications-trigger');bell.type='button';bell.setAttribute('aria-label',t('Annonces de la guilde','Guild announcements'));bell.appendChild(icon('bell'));bell.addEventListener('click',function(){renderNotifications();open(notifications,bell);});nav.insertBefore(bell,nav.querySelector('.nav-connexion'));}
document.querySelectorAll('.home-page .home-icon use').forEach(function(use){var href=use.getAttribute('href')||'';if(href.includes('nameless-icons.svg'))use.setAttribute('href',href.replace('nameless-icons.svg','reference-icons.svg'));});
scheduleIndicator();
}
global.NamelessReferenceShell={upgrade:upgrade,closePanel:closePanel,cancelPanelClose:cancelPanelClose};
document.addEventListener('nameless:routechange',function(){upgrade();if(menu?.open)menu.close();if(accountMenu?.open)accountMenu.close();if(notifications?.open)notifications.close();});
document.addEventListener('nameless:auth-changed',function(event){notificationGeneration++;if(event.detail&&Object.prototype.hasOwnProperty.call(event.detail,'user'))accountCleared=!event.detail.user;var accountFocused=document.activeElement.matches('.reference-account-trigger');if(accountMenu?.open)accountMenu.close();else if(accountCleared&&accountFocused)focusSignInAfterAuth();accountMenu?.querySelector('.reference-account-content')?.remove();syncAccountButton();if(notifications?.open)renderNotifications();});
document.addEventListener('nameless:languagechange',function(){upgrade();if(menu?.open)renderMenu();if(accountMenu?.open)renderAccount();if(notifications?.open)renderNotifications();document.querySelector('.reference-notifications-trigger')?.setAttribute('aria-label',t('Annonces de la guilde','Guild announcements'));});
document.addEventListener('close',function(event){if(!event.target.id)return;document.querySelectorAll('[aria-controls="'+event.target.id+'"]').forEach(function(button){button.setAttribute('aria-expanded','false');});},true);
global.addEventListener('resize',function(){scheduleIndicator();});
document.addEventListener('pointerover',function(event){var link=event.target.closest?.('.header .nav-menu a');if(link)updateIndicator(link);});
document.addEventListener('pointerout',function(event){var link=event.target.closest?.('.header .nav-menu a');if(link&&!link.contains(event.relatedTarget))updateIndicator();});
document.addEventListener('focusin',function(event){var link=event.target.closest?.('.header .nav-menu a');if(link)updateIndicator(link);});
document.addEventListener('focusout',function(event){if(event.target.closest?.('.header .nav-menu a'))scheduleIndicator();});
document.fonts?.ready.then(scheduleIndicator);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',upgrade,{once:true});else upgrade();
})(window);

