/**
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * https://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is a JavaScript implementation of Time Style Sheets (TSS).
 * 
 * The Initial Developer of the Original Code is IBM Research (Brazil).
 * Portions created by the Initial Developer are Copyright (C) 2015 
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Rodrigo Laiola Guimarães <http://www.rodrigolaiola.com>
 */

/**
 * @overview implements a Time Style Sheets (TSS) parser.
 * @requires cssParser
 * @license MPL v1.1
 * @version 0.1
 */

/** 
 * this module implements a Time Style Sheets (TSS) parser. Once the browser finishes loading the page completely, the TSS parser examines the associated styles and then triggers the <i>ontssparserready</i> event.
 * @module
 */

/* hide all time tags upfront */
{
	var time_style = document.createElement('style');
	time_style.setAttribute('id', 'tss-styles');
	time_style.type = 'text/css';
	time_style.innerHTML = 'body{} time {display: none;}'; /* body {} is a hack. Somehow jQuery Mobile breaks TSS */
	document.head.appendChild(time_style);
}
 
/**
 * @namespace window
 */
 
/**
 * Given an element or its selector, returns the computed TSS properties and CSS specificity.
 * @function
 * @param {String|Object} elem - Element selector (String) or its DOM reference (Object).
 * @return {Object[]} <pre>{
	specificity: Number,			// CSS specificity
	timingContainer: String,		// "par" or "seq"
	timingDelay: Number,
	timingDuration: Number | String,	// e.g., 10 or "infinite"
	timingIterationCount: Number,		// e.g., 1 or "infinite"
	timingPlayState: String,		// "running" or "paused"
	timingClipBegin: Number,
	timingClipEnd: Number,
	timingVolume: Number,
	timingSyncMaster: String,		// sync master selector
	timingCurrentTime: Number
}</pre>
 */
window.tss = {};

/* DOM tree is ready! */
document.onreadystatechange = function() {
	/* hide body to avoid flickering behaviour. We will show it ontssparserready event */
	document.body.style.visibility = 'hidden';

    if (document.readyState === 'complete') {
    
    	/* start timers to track how long the parser execution takes */
		try {
			/* http://www.html5rocks.com/en/tutorials/webperformance/usertiming/ */
			window.performance.mark('tss_parser');
		} catch (e) {
			console.time('tss_parser');
		}

		/* for now, let's pause audio and video elements with the autoplay attribute */
		{
			var allElements = document.getElementsByTagName('*');
			for (var i = 0, n = allElements.length; i < n; i++) {
				if (allElements[i].hasAttribute('autoplay') && 
					(allElements[i].nodeName != 'VIDEO' || 
					allElements[i].nodeName != 'AUDIO')) {
					allElements[i].pause();
				}
			}
		}
		
    	window.tss = new function() {
			/*************************
			 * private variables
			 *************************/
			 
			var that = this;
			
			/* keep track of time style sheets selectors, elements and pseudo-classes */
			var tss_selectors = {};
			var tss_elements = {};
			
			/**/
			var TSS_TIME_TAGS = true;
			var TSS_STYLE_TAGS = true;
			
			/*************************
			 * private functions
			 *************************/
			 
			/* merge contents of two objects together into the first object */
			function extend(a, b, force) {
				for (var key in b)
					if (!a[key] || force) a[key] = b[key];
				return a;
			}
			
			/* capitalize a letter following a dash and remove the dash 
			   source: http://stackoverflow.com/questions/6009386/capitalizing-the-letter-following-a-dash-and-removing-the-dash
			*/
			function camelCase (string) {
				return string.replace( /-([a-z])/ig, function(all, letter) {
					return letter.toUpperCase();
				});
			}
			
			/* verify if a given property is valid within tss workspace */
			function isValidTSSProperty(property) {
				/* standard timing properties */
				if (property == 'timing-container' || 
					property == 'timing-delay' ||
					property == 'timing-duration' ||
					property == 'timing-iteration-count' ||
					property == 'timing-play-state' ||
					/* timing properties related to continuous media */
					property == 'timing-clip-begin' ||
					property == 'timing-clip-end' ||
					property == 'timing-volume' ||
					property == 'timing-sync-master' ||
					/* non-standard timing properties */
					property == 'timing-current-time') {
					return true;
				}
				else return false;
			}
			
			/* compute the valid value of a property */
			function getValidTSSValue(property, value) {
				switch(property) {
					case 'timing-container':
						if (value == 'par' || value == 'seq') return value;
						else return 'par';
						break;
					case 'timing-delay':
						if (typeof parseFloat(value) == 'number' && parseFloat(value) >= 0.0) return parseFloat(value);
						else return 0;
						break;
					case 'timing-duration':
						if (typeof parseFloat(value) == 'number' && parseFloat(value) >= 0.0) return parseFloat(value);
						else if (value == 'infinite') return value;
						else if (value == 'implicit') return undefined;
						else return 0.0;
						break;
					case 'timing-iteration-count':
						if (typeof parseInt(value) == 'number' && parseInt(value) >= 0.0) return parseInt(value);
						else if (value == 'infinite') return value;
						else return 1;
						break;
					case 'timing-play-state':
						if (value == 'paused' || value == 'running') return value;
						else return 'running';
						break;
					/* timing properties related to continuous media */
					case 'timing-clip-begin':
						if (typeof parseFloat(value) == 'number' && parseFloat(value) >= 0.0) return parseFloat(value);
						else return 0;
						break;
					case 'timing-clip-end':
						if (typeof parseFloat(value) == 'number' && parseFloat(value) >= 0.0) return parseFloat(value);
						else return undefined;
						break;
					case 'timing-volume':
						if (typeof parseFloat(value) == 'number' && parseFloat(value) >= 0.0 && parseFloat(value) <= 1.0)
							return parseFloat(value);
						else return 1.0;
						break;
					case 'timing-sync-master':
						return value;
						break;
					/* non-standard timing properties */
					case 'timing-current-time':
						return value;
						break;
					default:
						break; 
				}
				
				return null;
			}
			
			/* use jscssp to parse time style sheets as if it were css. if elem is defined 
			   return its time properties */
			function parse(tss_str, elem) {
				/* remove comments from string */
				var comments = /(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)|(\<\!\-\-([\s\S]*?)\-\-\>)/gm;
				tss_str = tss_str.replace(comments,'');
	
				var parser = new CSSParser();
				var sheet = parser.parse(tss_str, false, true);
				/* console.log(sheet.cssText()); */
	
				if (sheet) {
					/* parse time styles and return resulting style */
					if (elem) {
						var properties = {};
						/* iterate through properties */
						for (var j=0; j<sheet.cssRules[0].declarations.length; j++) {
							/* console.log('\t' + sheet.cssRules[0].declarations[j].property + 
								' = ' + 
										sheet.cssRules[0].declarations[j].valueText); */
							
							if (isValidTSSProperty(sheet.cssRules[0].declarations[j].property)) {
								var pName = camelCase(sheet.cssRules[0].declarations[j].property);
								properties[pName] = 
									getValidTSSValue(sheet.cssRules[0].declarations[j].property, sheet.cssRules[0].declarations[j].valueText);
							}
						}
			
						/* console.log(properties); */
						/* workaround: think over a cleaner way */
						var tsshash = elem.getAttribute('tss-hash');
						if (!tsshash) {
							tsshash = Math.floor(Math.random()*90000) + 10000;
							elem.setAttribute('tss-hash', tsshash);
						}
						tss_elements[tsshash] = extend(properties, tss_elements[tsshash]);
						return tss_elements[tsshash];
					}
					/* parse and store time styles */
					else {
						for (var i=0; i<sheet.cssRules.length; i++) {
							if (!sheet.cssRules[i].mSelectorText || 
								sheet.cssRules[i].mSelectorText.trim() == '')
								continue;
							
							/* console.log(sheet.cssRules[i].mSelectorText); */
							
							/* split into multiple selectors, if necessary */
							var selectors = sheet.cssRules[i].mSelectorText.split(',');
							
							for (var j=0; j<selectors.length; j++) {
								/* is it a pseudo class? If so, we need to process it */
								if (selectors[j].trim().indexOf(':') != -1) {
									var s = selectors[j].substring(0, selectors[j].indexOf(':'));
									var pseudoc = selectors[j].substring(selectors[j].indexOf(':')+1, selectors[j].length);
									/*console.log(s + ' ' + pseudo);*/
									
									/* process properties inside the 'for' works clone function for
								       all selectors */
									var properties = {};
									/* iterate through properties */
									for (var k=0; k<sheet.cssRules[i].declarations.length; k++) {
										/* console.log('\t' + 
											sheet.cssRules[i].declarations[k].property + ' = ' + 
													sheet.cssRules[i].declarations[k].valueText); */
									
										var pName = sheet.cssRules[i].declarations[k].property;
										properties[pName] = sheet.cssRules[i].declarations[k].valueText;
									}
									
									/*console.log(s + '[tss-state=' + pseudoc + ']');
									console.log(properties);*/
									
									var styleTag = document.getElementById('tss-styles');
									var sheet_aux = styleTag.sheet ? styleTag.sheet : styleTag.styleSheet;
									
									function toString(array) {
										var t = '';
										
										if (!array || array.length == 0) return t;
										
										for (var key in array)
											t = t + key + ': ' + array[key] + '; ';
										
										return t;
									}
									/* http://davidwalsh.name/add-rules-stylesheets */
									/* as a workaround, we decided to use a class[attribute] approach */
									try {
										sheet_aux.insertRule(s + '[tss-state=' + pseudoc + '] {' + toString(properties) + '}', 1);
									} catch (e) {}
								}
								/* it is an ordinary selector */
								else {
									/* process properties inside the 'for' works clone function for
								   all selectors */
									var properties = {};
									/* iterate through properties */
									for (var k=0; k<sheet.cssRules[i].declarations.length; k++) {
										/* console.log('\t' + 
											sheet.cssRules[i].declarations[k].property + ' = ' + 
													sheet.cssRules[i].declarations[k].valueText); */
									
										if (isValidTSSProperty(sheet.cssRules[i].declarations[k].property)) {
											var pName = camelCase(sheet.cssRules[i].declarations[k].property);
											properties[pName] = getValidTSSValue(sheet.cssRules[i].declarations[k].property, sheet.cssRules[i].declarations[k].valueText);
										}
									}
					
									/* does this selector already exist? */
									tss_selectors[selectors[j].trim()] ?
										/* extend existing properties */
										tss_selectors[selectors[j].trim()] = 
											extend(properties, tss_selectors[selectors[j].trim()]) :
										/* otherwise, add these properties as current */
										tss_selectors[selectors[j].trim()] = properties;
								}
							}
						}
			
						return;
					}
				}
				else
					console.log('error parsing time style sheets');
			}
			
			/* calculate the tss specificity based on css specification */
			function getSpecificity(selector) {
				/* has it been already calculated? If so, just return it */
				if (tss_selectors[selector] && tss_selectors[selector].specificity)
					return tss_selectors[selector].specificity;
	
				/* split a given selector into smaller pieces */
				function parse_selector(sel) {
					/* split each selector group by combinators ' ', '+', '~', '>'
					   :not() is a special case, do not include it as a pseudo-class */
					sel = sel.replace(/\#+/g, ' #');
					sel = sel.replace(/\.+/g, ' .');
					sel = sel.replace(/\:+/g, ' :');
					sel = sel.replace(/\[+/g, ' [');
		
					/* '*' has no specificity */
					sel = sel.replace(/\*+/g, ' ');
		
					/* for the selector div > p:not(.foo) ~ span.bar,
					   sample output is ['div', 'p', '.foo', 'span', '.bar'] */
					return sel.split(/\ +|\++|\~+|\>+/).filter(function(n){return n});
				}
	
				/* split selector */
				var ss = parse_selector(selector);
	
				/* calculate specificity based on tss rules */
				var a = b = c = 0;
				for (var i=0; i<ss.length; i++) {
					/* look for ids -> # */
					a = a + (ss[i].match(/\#/) ? ss[i].match(/\#/).length : 0);
					/* look for classes -> ., pseudo classes -> :, or attributes -> [] */
					b = b + (ss[i].match(/\./) ? ss[i].match(/\./).length : 0) +
							(ss[i].match(/:[:]+/) ? ss[i].match(/:[:]+/).length : 0) +
							(ss[i].match(/\[.+\]$/) ? ss[i].match(/\[.+\]$/).length : 0);
				}
				/* look for elements */
				var c = ss.length - (a + b);
	
				return parseInt('' + a + b + c);
			}
			
			/* sort list of time sheets' selectors based on tss specificity (same as css)
			 source: stackoverflow.com/questions/5158631/sorting-a-set-of-css-selectors-on-the-basis-of-specificity */
			function sortBySpecificity(selectors) {
				if (!selectors) return {};
				
				var simple_selectors = [];
				
				for (var sel in selectors) {
					simple_selectors.push({key: sel, specificity: getSpecificity(sel)});
				}
				
				/* console.log(simple_selectors); */
				/* sort time styles based on specificity (highest -> lowest). */
				return simple_selectors.sort(
					function(a,b) { 
						return b.specificity - a.specificity;
					}
				);
			}
			
			/* compute parsed styles to DOM elements */
			function compute(targetElem, styleAdded) {
				/* sort selectors based on specificity */
				var selectors = sortBySpecificity(tss_selectors);
				
				/* for now, we compute styles for all elements. We need to double check that in the future */
				if (styleAdded) tss_elements = [];
				
				/*for (var i=0; i<selectors.length; i++) {
					console.log(selectors[i]);
				}*/
				
				/* first, compute time styles based on parsed selectors */
				for (var i=0; i<selectors.length; i++) {
					/* register specificity of this selector */
					tss_selectors[selectors[i].key].specificity = selectors[i].specificity;
					
					/* source: http://stackoverflow.com/questions/886863/best-way-to-find-dom-elements-with-css-selectors */
					var elems = document.querySelectorAll(selectors[i].key);
					
					/* console.log(selectors[i].key + ' ' + selectors[i].specificity + ' ' + elems.length); */
					
					for (var j=0; j<elems.length; j++) {
						var elem = elems[j];
						var timeStyles = tss_selectors[selectors[i].key];
						
						/* if targetElem has been defined we will try to parse it only */
						if (!elem || (targetElem && elem != targetElem)) continue;
						
						/* has the element been already processed? */
						/* workaround: think over a cleaner way */
						var tsshash = elem.getAttribute('tss-hash');
						if (!tsshash) {
							tsshash = Math.floor(Math.random()*90000) + 10000;
							elem.setAttribute('tss-hash', tsshash);
						}
						
						if (tss_elements[tsshash] != null) {
							/* console.log(elem.getAttribute('style')); */
							timeStyles = extend(tss_elements[tsshash], timeStyles);
						}
						/* does it have a style attribute? */
						else if (elem.getAttribute('style') != null) {
							/* console.log(elem.getAttribute('style')); */
							timeStyles = extend(parse('{' + elem.getAttribute('style') + '}', elem), 
											timeStyles);
						}
						
						/* set as parsed */
						elem.setAttribute('tss-parsed', true);
						/* and store current time properties */
						tss_elements[tsshash] = timeStyles;
					}
				}
				
				/* continue only if we are not focusing on a targetElem */
				if (!targetElem) {
					/* we also need to iterate through inline styles that have not been caught by selectors */
					var timeStyles = document.body.getElementsByTagName('*');
					for (var i=0; i<timeStyles.length; i++) {
						var elem = timeStyles[i];
						if (!elem.getAttribute('tss-parsed')) {
							/* workaround: think over a cleaner way */
							var tsshash = elem.getAttribute('tss-hash');
							if (!tsshash) {
								tsshash = Math.floor(Math.random()*90000) + 10000;
								elem.setAttribute('tss-hash', tsshash);
							}
							
							if (elem.getAttribute('style') != null) {
								/* console.log(elem.getAttribute('style')); */
								tss_elements[tsshash] = parse('{' + elem.getAttribute('style') + '}', elem);
							}
							
							/* does it have an autoplay attribute? */
							if (elem.hasAttribute('autoplay')) {
								/* console.log(elem.getAttribute('style')); */
								tss_elements[tsshash] = extend({'timingPlayState' : 'running'}, tss_elements[tsshash]);
								elem.removeAttribute('autoplay');
							}
						}
					}
					
					/* let's show body tag (but when new styles are inserted) */
					if (!styleAdded) document.body.style.visibility = '';
					
					/* stop timers that were previously started by calling console.time() and User Timing API */
					try {
						window.performance.measure('tss_parser');
						console.log('calculating tss_parser.js execution time: ' +
							(window.performance.getEntriesByType('measure')[0].duration
							- window.performance.getEntriesByType('mark')[0].startTime).toPrecision(5) + "ms");
					} catch (e) {
						console.timeEnd('calculating tss_parser.js execution time');
					}
					
					/**
					 * triggered when the TSS parser is done examining the associated styles.
					 *
					 * @event ontssparserready
					 * @type {Object}
					 * @property {Boolean} detail - True, if the event is associated with a new style added after the page is loaded for the first time. False, otherwise.
					 */
					var tssEvent;
					try {
						/* new browsers */
						tssEvent = new CustomEvent('ontssparserready', { 'detail': styleAdded });
					} catch(e) {
						/* old browsers: deprecated */
						tssEvent = document.createEvent('Event');
						tssEvent.initEvent('ontssparserready', true, true);
						tssEvent.detail = styleAdded;
					}
					/* fire ontssparserready. If a new style has been added we add this info to the event */
					document.dispatchEvent(tssEvent);
				}
			}
			
			/* initialize time style sheets parser */
			function init() {
				/* note: tss embedded in the html always come after external time sheets (imports)
						 regardless of the order in the html (same behavior as css).
				*/
				function parseEmbeddedTimeSheets() {
					if (TSS_STYLE_TAGS) {
						var timeTags = document.getElementsByTagName('style');
						for (var i=0; i<timeTags.length; i++) {
							parse(timeTags[i].innerHTML, null);
						}
					}
					
					if (TSS_TIME_TAGS) {
						var timeTags = document.getElementsByTagName('time');
						for (var i=0; i<timeTags.length; i++) {
							parse(timeTags[i].innerHTML, null);
						}
					}
					
					/* once we parsed everything it is time to compute all time styles */
					compute();
				}
				
				/* calculate the number of time sheets imports */
				var timeLinksCounter = 0;
				var timeLinks = document.getElementsByTagName('link');
				for (var i=0; i<timeLinks.length; i++) {
					var link = timeLinks[i];
					if ( (TSS_TIME_TAGS && (link.rel == 'timesheet' || link.type == 'text/tss')) ||
						 (TSS_STYLE_TAGS && (link.rel == 'stylesheet' || link.type == 'text/css')))
						timeLinksCounter = timeLinksCounter + 1; /* count the number of time sheets links */
				}
				
				/* parse embedded time tags if there is no import links */
				if (timeLinksCounter == 0) {
					parseEmbeddedTimeSheets();
				}
				/* otherwise, we will handle embedded styles only after all imports have been processed */
				else {
					for (var i=0; i<timeLinks.length; i++) {
						var link = timeLinks[i];
						if ( TSS_TIME_TAGS && (link.rel == 'timesheet' || link.type == 'text/tss') ||
							 TSS_STYLE_TAGS && (link.rel == 'stylesheet' || link.type == 'text/css') ) {
				
							/* initialize the Ajax request */
							function importTimeSheet(l) {
								var xhr = new XMLHttpRequest();
								xhr.open('get', l.href);
					
								/* track the state changes of the request */
								xhr.onreadystatechange = function() {
									/* ready state 4 means the request is done */
									if (xhr.readyState === 4) {
										/* 200 is a successful return */
										if(xhr.status === 200) {
											/* console.log(xhr.responseText); */
											parse(xhr.responseText, null);
										} else {
											/* An error occurred during the request */
											console.log('error importing time style sheets: ' + xhr.status);
										}
							
										timeLinksCounter = timeLinksCounter - 1;
										/* is this the last import? */
										if (timeLinksCounter == 0) {
											parseEmbeddedTimeSheets();
										}
									}
								}
					
								/* Send the request */
								xhr.send(null);
							}
							
							importTimeSheet(link);
						}
					}
				}
			}
			
			/* this allows us to capture and compute dynamic modications on the document accordingly */
			function initMutationObserver() {
				/* select the target node */
				var target = document.querySelector('body');
				
				function processNewNode(child) {
					if (child.nodeType === 1 && 
						child.nodeName != 'SCRIPT' &&
						child.nodeName != 'LINK' &&
						child.nodeName != 'STYLE' &&
						child.nodeName != 'SOURCE' &&
						child.nodeName != 'TIME') {
						/* are there styles defined in this element? If so, they will not be detected automatically */
						var styleMatches = child.querySelectorAll('style');
						for (var i=0; i<styleMatches.length; i++) {
							parse(styleMatches[i].innerHTML, null);
						}
						
						if (styleMatches.length > 0)
							/* double check that in the future */ 
							compute(child, styleMatches.length > 0);
						else compute(child);
					}
					else if (child.nodeName == 'LINK') {
						/* TODO */
					} 
					else if ((child.nodeName == 'STYLE' && TSS_STYLE_TAGS) ||
							(child.nodeName == 'TIME' && TSS_TIME_TAGS)) {
						/* parse embedded style */
						parse(child.innerHTML, null);
						
						compute(null, true);
					}
				}
				
				/* new browsers */
				try {
					/* create an observer instance
					   source: https://developer.mozilla.org/en/docs/Web/API/MutationObserver 
					*/
					var observer = new MutationObserver(function(mutations) {
						mutations.forEach(function(mutation) {
							switch (mutation.type) {
								case 'childList':
									/* process new elements */
									for (var i=0; i<mutation.addedNodes.length; i++) {
										var child = mutation.addedNodes[i];
										
										processNewNode(child);
									}
									
									/* process removed elements */
									/*for (var i=0; i<mutation.removedNodes.length; i++) {
										var child = mutation.removedNodes[i];
									}*/
									break;
								case 'attributes':
									if (mutation.attributeName == 'style') {
										/* we need to check whether a TSS property has been updated */
									}
									break;
								default:
									break;
							}
						});
					});
					
					/* configuration of the observer */
					var config = { attributes: true, childList: true, characterData: true, subtree: true };
					
					/* pass in the target node, as well as the observer options */
					observer.observe(target, config);
					
					/* later, we can stop observing document mutations */
					/*observer.disconnect();*/
				} catch(e) {
					/* old browsers: deprecated */
					target.addEventListener('DOMNodeInserted', function (ev) {
						if (ev.target != null) processNewNode(ev.target);
					}, false);
				}
			}
			
			/*************************
			 * public functions
			 *************************/
			
			that.lookup = function(obj) {
				/* is it a selector? */
				if (typeof obj == 'string') {
					var r = tss_selectors[obj];
					if (r) {
						/* if specificity is not defined yet, set it and return */
						if (!r.specificity) r.specificity = getSpecificity(obj)
						return r;
					}
					else return {specificity: getSpecificity(obj)};
				}
				/* otherwise it is an element */
				else {
					/* worst case, we should compute the styles for the element in its first time */
					if (!obj.getAttribute('tss-hash')) compute(obj);
					
					return tss_elements[obj.getAttribute('tss-hash')];
				}
			}
			
			/* workaround: we need to set this global variable before init */
			window.tss = that.lookup;
			
			/* call initialization function */
			init();
			
			/* initialize mutation observer */
			initMutationObserver();
			
			return that.lookup;
		}
    }
};
