/* Persistent reference header: real navigation, optional scenery/audio controls,
   and member-only announcements. No synthetic notification or player data. */
(function(global){
'use strict';
if(global.NamelessReferenceShell)return;
var sprite='/assets/ui/reference-icons.svg',emblem='/assets/brand/nameless-reference-emblem.svg';
var menu=null,notifications=null,notificationGeneration=0,dialogId=0,opener=null;
function en(){return global.NamelessI18n&&global.NamelessI18n.getLanguage()==='en';}
function t(fr,english){return en()?english:fr;}
function icon(name){var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','reference-header-icon');svg.setAttribute('aria-hidden','true');var use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',sprite+'#icon-'+name);svg.appendChild(use);return svg;}
function el(tag,cls,text){var node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;}
function dialog(title){var d=el('dialog','reference-dialog nm-game-frame');d.dataset.i18nIgnore='';var head=el('div','reference-dialog-head');var h=el('h2','',title);h.id='reference-heading-'+(++dialogId);d.setAttribute('aria-labelledby',h.id);var close=el('button','reference-dialog-close','×');close.type='button';close.setAttribute('aria-label',t('Fermer','Close'));close.addEventListener('click',function(){d.close();});head.append(h,close);d.appendChild(head);d.addEventListener('click',function(event){if(event.target!==d)return;var rect=d.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)d.close();});d.addEventListener('keydown',function(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();d.close();}});d.addEventListener('close',function(){if(opener&&opener.isConnected)opener.focus();});document.body.appendChild(d);return d;}
function open(d,button){if(d.open)return;opener=button;if(d===menu){d.id='reference-navigation';button.setAttribute('aria-controls',d.id);button.setAttribute('aria-expanded','true');}d.showModal();}
function renderMenu(){
if(!menu)menu=dialog(t('Nameless · Navigation','Nameless · Navigation'));
menu.querySelector('h2').textContent=t('Nameless · Navigation','Nameless · Navigation');
menu.querySelector('.reference-dialog-close').setAttribute('aria-label',t('Fermer','Close'));
var active=document.activeElement,focusedAction=menu.contains(active)?active.dataset.referenceAction:null;
var focusedHref=menu.contains(active)?active.getAttribute('href'):null;
var links=menu.querySelector('.reference-menu-links');if(links)links.remove();links=el('nav','reference-menu-links');links.setAttribute('aria-label',t('Explorer Nameless','Explore Nameless'));
[['/','map','Accueil','Home'],['/carte','map','Carte d’Aincrad','Aincrad map'],['/bestiaire','bestiary','Bestiaire','Bestiary'],['/items','items','Objets','Items'],['/wiki','map','Guides et wiki','Guides and wiki'],['/espace-guilde','guild','Quartier général','Headquarters'],['/profil','user','Mon profil','My profile']].forEach(function(row){var a=el('a','',t(row[2],row[3]));a.href=row[0];a.prepend(icon(row[1]));a.addEventListener('click',function(){menu.close();});links.appendChild(a);});menu.appendChild(links);
var settings=menu.querySelector('.reference-preferences');if(settings)settings.remove();settings=el('div','reference-preferences');
var motion=el('button','',t('Animations du décor','Scenery animations'));motion.type='button';var homeButton=document.querySelector('[data-home-motion]');motion.disabled=!homeButton||homeButton.disabled;motion.textContent=homeButton?t(homeButton.getAttribute('aria-pressed')==='true'?'Animer le décor':'Pause du décor',homeButton.getAttribute('aria-pressed')==='true'?'Resume scenery':'Pause scenery'):t('Contrôle du décor disponible sur l’accueil','Scenery control is available on the homepage');motion.addEventListener('click',function(){var target=document.querySelector('[data-home-motion]');if(target)target.click();renderMenu();});settings.appendChild(motion);
motion.dataset.referenceAction='motion';
var audio=el('button','',t('Activer l’ambiance sonore','Enable ambient sound'));audio.type='button';audio.dataset.referenceAction='audio';var target=document.querySelector('.nm-audio-btn');audio.disabled=!target;audio.setAttribute('aria-pressed',target?target.getAttribute('aria-pressed')||'false':'false');if(target&&target.getAttribute('aria-pressed')==='true')audio.textContent=t('Couper l’ambiance sonore','Mute ambient sound');audio.addEventListener('click',function(){document.querySelector('.nm-audio-btn')?.click();renderMenu();});settings.appendChild(audio);menu.appendChild(settings);
if(focusedAction)menu.querySelector('[data-reference-action="'+focusedAction+'"]')?.focus();
else if(focusedHref)Array.from(links.querySelectorAll('a')).find(function(link){return link.getAttribute('href')===focusedHref;})?.focus();
}
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
var logo=nav.querySelector('.nav-logo-safe');if(logo){logo.src=emblem;logo.removeAttribute('srcset');logo.width=40;logo.height=46;}
var login=nav.querySelector('#login-link');if(login&&!login.querySelector('svg'))login.prepend(icon('user'));
var hamburger=nav.querySelector('#hamburger');if(hamburger&&!hamburger.dataset.referenceBound){hamburger.dataset.referenceBound='true';hamburger.addEventListener('click',function(){if(global.innerWidth<=768)return;renderMenu();open(menu,hamburger);});}
if(!nav.querySelector('.reference-notifications-trigger')){var bell=el('button','reference-notifications-trigger');bell.type='button';bell.setAttribute('aria-label',t('Annonces de la guilde','Guild announcements'));bell.appendChild(icon('bell'));bell.addEventListener('click',function(){renderNotifications();open(notifications,bell);});nav.insertBefore(bell,nav.querySelector('.nav-connexion'));}
document.querySelectorAll('.home-page .home-icon use').forEach(function(use){var href=use.getAttribute('href')||'';if(href.includes('nameless-icons.svg'))use.setAttribute('href',href.replace('nameless-icons.svg','reference-icons.svg'));});
}
global.NamelessReferenceShell={upgrade:upgrade};
document.addEventListener('nameless:routechange',function(){upgrade();if(menu?.open)menu.close();if(notifications?.open)notifications.close();});
document.addEventListener('nameless:auth-changed',function(){notificationGeneration++;if(notifications?.open)renderNotifications();});
document.addEventListener('nameless:languagechange',function(){upgrade();if(menu?.open)renderMenu();if(notifications?.open)renderNotifications();document.querySelector('.reference-notifications-trigger')?.setAttribute('aria-label',t('Annonces de la guilde','Guild announcements'));});
document.addEventListener('close',function(event){if(event.target===menu)document.querySelector('#hamburger')?.setAttribute('aria-expanded','false');},true);
global.addEventListener('resize',function(){var button=document.querySelector('#hamburger');if(global.innerWidth<=768){if(menu?.open)menu.close();button?.setAttribute('aria-controls','nav-menu');}else if(menu)button?.setAttribute('aria-controls',menu.id||'reference-navigation');});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',upgrade,{once:true});else upgrade();
})(window);

