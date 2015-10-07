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

/**
 * @overview implements a temporal semantics of the Time Style Sheets (TSS) specification.
 * @requires tss_parser
 * @license MPL v1.1
 * @version 0.1
 */

/** 
 * this module implements a temporal renderer that schedules the document presentation accordingly after the <i>ontssparserready</i> event is triggered. It also extends the DOM elements with the computed TSS properties and events, so that these can still be read or updated at any time, as demonstrated in the examples below.
 *
 * @module
 *
 * @example
 * // Ex1: specify that the children elements will presented in sequence.
 * CSS syntax -> selector { timing-container: seq; }
 * JS syntax -> object.style.timingContainer = "seq";
 *              console.log(object.style.timingContainer); // seq
 *
 * @example
 * // Ex2: specify that the element will start with a delay of 2s.
 * CSS syntax -> selector { timing-delay: 2s; }
 * JS syntax -> object.style.timingDelay = "2s";
 *              console.log(object.style.timingDelay);    // 2
 *
 * @example
 * // Ex3: set the element's presentation state to running.
 * CSS syntax -> selector { timing-play-state: running; }
 * JS syntax -> object.style.timingPlayState = "running";
 *              console.log(object.style.timingPlayState); // running
 *
 * @example
 * // Ex4: run a custom function when the onbegin event is triggered
 * HTML syntax -> <element onbegin=”SomeJavaScriptCode”>...</element>
 * JS syntax -> object.onbegin=function(){SomeJavaScriptCode};
 */

/* 
 * support functions 
 */

/* merge contents of two objects and put into the first object */
function extend(a, b, force) {
	for (var key in b) {
		var pa = Object.getOwnPropertyDescriptor(a, key);
		var pb = Object.getOwnPropertyDescriptor(b, key);
		
		if (!pa || force) {
			if (pb && pb.get) {
				Object.defineProperty(a, key, {
					get : pb.get,
					set : pb.set,
					enumerable: pb.enumerable,
					configurable: pb.configurable
				});
			} else {
				Object.defineProperty(a, key, {
					value: pb.value,
					enumerable: pb.enumerable,
					writable: pb.writable,
					configurable: pb.configurable
				});
			}
		}
	}
	
	return a;
}

/* check if an element has a given class */
HTMLElement.prototype.hasClass = function(name) {
    return new RegExp('(?:^|\\s+)' + name + '(?:\\s+|$)').test(this.className);
}

/* add a class(es) to an element */
HTMLElement.prototype.addClass = function(classes) {
	if (!classes) return;
	
	classes = classes.split(' ');
	for (var i=0; i<classes.length; i++) {
		if (!this.hasClass(classes[i])) {
			this.className = this.className ? [this.className, classes[i]].join(' ') : classes[i];
		}
	}
}

/* remove a class(es) from an element */
HTMLElement.prototype.removeClass = function(classes) {
	if (!classes) return;
	
	classes = classes.split(' ');
	for (var i=0; i<classes.length; i++) {
		if (this.hasClass(classes[i])) {
			var c = this.className;
			this.className = c.replace(new RegExp('(?:^|\\s+)' + classes[i] + '(?:\\s+|$)', 'g'), '');
		}
	}
}

/* bind handler to given event(s) */
HTMLElement.prototype.bind = function(events, handler, asFirst) {
	if (!events) return;
	
	events = events.split(' ');
	for (var i=0;i<events.length;i++) {
		if (!this['ontss' + events[i]]) this['ontss' + events[i]] = new Array();
		if (asFirst) this['ontss' + events[i]].unshift(handler);
		else this['ontss' + events[i]].push(handler);
		
		if (this.addEventListener) {							/* DOM Level 2 browsers */
			if (asFirst) {
				for (var j=0; j<this['ontss' + events[i]].length; j++) {
					this.removeEventListener(events[i], this['ontss' + events[i]][j]);
				}
				
				for (var j=0; j<this['ontss' + events[i]].length; j++) {
					this.addEventListener(events[i], this['ontss' + events[i]][j]);
				}
			}
			else this.addEventListener(events[i], handler, false);
		} else if (this.attachEvent) {							/* IE <= 8 */
			if (asFirst) {
				for (var j=0; j<this['ontss' + events[i]].length; j++) {
					this.detachEvent('on' + events[i], this['ontss' + events[i]][j]);
				}
				
				for (var j=0; j<this['ontss' + events[i]].length; j++) {
					this.attachEvent('on' + events[i], this['ontss' + events[i]][j]);
				}
			}
			else this.attachEvent('on' + events[i], handler);
		} else {												/* ancient browsers */
			
		}
	}
}

/* unbind handler to given event(s) */
HTMLElement.prototype.unbind = function(events, handler) {
	if (!events) return;
	
	events = events.split(' ');
	for (var i=0;i<events.length;i++) {
		if (this.removeEventListener) { /* DOM Level 2 browsers */
			for (var j=0; this['ontss' + events[i]] && j<this['ontss' + events[i]].length; j++) {
				if (!handler) this.removeEventListener(events[i], this['ontss' + events[i]][j]);
				else if (handler == this['ontss' + events[i]][j]) {
					this.removeEventListener(events[i], this['ontss' + events[i]][j]);
					this['ontss' + events[i]].splice(j, 1);
					j--;
				}
			}
		} else if (this. detachEvent) { /* IE <= 8 */
			for (var j=0; j<this['ontss' + events[i]].length; j++) {
				if (!handler) this.detachEvent('on' + events[i], this['ontss' + events[i]][j]);
				else if (handler == this['ontss' + events[i]][j]) {
					this.detachEvent('on' + events[i], this['ontss' + events[i]][j]);
					this['ontss' + events[i]].splice(j, 1);
					j--;
				}
			}
		} else { 						/* ancient browsers */
			
		}
		
		if (!handler) this['ontss' + events[i]] = null;
	}
}

/* trigger a given event */
HTMLElement.prototype.trigger = function(event, args) {
	var ev;
	
	try {
		/* new browsers */
		ev = new CustomEvent(event, { 'detail': args });
	} catch(e) {
		/* old browsers: deprecated */
		ev = document.createEvent('Event');
		ev.initEvent(event, true, true);
		ev.detail = args;
	}
	
	if (document.createEvent) {
		this.dispatchEvent(ev);
	} else if (this.fireEvent) {
		element.fireEvent('on' + ev.eventType, event);
	} else if (this['on' + event] || false) {
		for (var i=0; i<this['ontss' + ev.type].length; i++) {
			if (typeof this['ontss' + ev.type][i] == 'function') this['ontss' + ev.type][i](event, args);
		}
	}
};
 
/* 
 * renderer implementation 
 */

/* define master clock */
(function() {
	window.performance = window.performance || {};
	performance.now = (function() {
		return performance.now    ||
			performance.mozNow    ||
			performance.msNow     ||
			performance.oNow      ||
			performance.webkitNow ||            
			Date.now  /* none found - fallback to browser default */
	})();
	
	var Tempo = function() {
		/* private variables */
		this.timeout = 40;			/* clock timeout: 40ms or 25 fps */
		this.itemList = [];			/* list of items that require time support */
		this.lastTimeout = null;	/* last registered time */
		
		/* init method */
		var that = this;
		var initialize = function() {
			that.lastTimeout = performance.now();
			that.timeupdate();
		};
		
		initialize();
	};
	Tempo.prototype = {
		/* register item */
		add : function(item) {
			for (var i=0;i<this.itemList.length;i++) {
				if (this.itemList[i] == item) {
					return false;
				}
			}
			
			this.itemList.push(item);
			
			/* is it the first item? If so, we shall start the timer */
			if (this.itemList.length == 1) {
				this.lastTimeout = null;
				this.timeupdate();
			}
			
			return true;
		},
		/* remove item */
		remove : function(item) {
			for (var i=0;i<this.itemList.length;i++) {
				if (this.itemList[i] == item) {
					this.itemList.splice(i, 1);
					return true;
				}
			}
			
			return false;
		},
		/* compute the elapsed time */
		timeupdate : function() {
			/* shall we stop the timer? */
			if (this.itemList.length == 0) 
				return;
			
			/* if not, let's get some time update done */
			var now = performance.now();
			var timeOffset = now - this.lastTimeout;
			this.lastTimeout = now;
			
			/* update current time of all registered elements */
			for (var i=0;i<this.itemList.length;i++) {
				var item = this.itemList[i];
				item.trigger('tempoupdate', timeOffset);
			}
			
			/* recursively re-run the function */
			setTimeout('window.tempo.timeupdate()', this.timeout);
		}
	};
	
	window.tempo = new Tempo();
})()

/* define event names */
var TSS_PLAY_EVENT			= 'onplay';
var TSS_PAUSE_EVENT			= 'onpause';
var TSS_BEGIN_EVENT			= 'onbegin';
var TSS_END_EVENT			= 'onend';
var TSS_YIELD_EVENT			= 'onyield';
var TSS_WAIT_EVENT			= 'onwait';
var TSS_CAN_PLAY_EVENT		= 'oncanplay';
var TSS_TIMEUPDATE_EVENT	= 'ontimeupdate';

/* define temporal containers and media objects */
window.TSSPar;
window.TSSSeq;
window.TSSMedia;

(function() {
	
	var parseItem = function(elem, parent) {
		if (!elem) return;
		
		var item;
		var options = extend({}, window.tss(elem) ? window.tss(elem) : {});
		options.domNode = elem;
		options.parent = parent;
		if (!options.timingContainer) {
			if (elem.nodeType === 1 && 
				(elem.nodeName == 'VIDEO' || 
				elem.nodeName == 'AUDIO' ||
				elem.nodeName == 'IMG'));
			else options.timingContainer = 'par';
		}
		switch (options.timingContainer) {
			case 'seq':
				item = new TSSSeq(options);
				break;
			case 'par':
				item = new TSSPar(options);
				break;
			default:
				item = new TSSMedia(options);
				break;
		}
		return item;
	}
	
	function findSyncMaster(sync) {
		/* returns the first element that matches a particular CSS selector(s) in the document */
		return document.querySelector(sync);
	}
	
	TSSPar = function(options) {
		/* default options */
		var settings = extend(options, {
			timingDelay:			null,
			timingDuration:			null,
			timingIterationCount:	1,
			timingPlayState:		null,
			timingSyncMaster:		null,
			domNode:				null,
			parent:					null
		});
		
		/* 
		 * private variables 
		 */
		
		/* keep self reference */
		var self = settings.domNode;
		
		/* before doing anything, test wether this node has already been instantiated */
		if (Object.getOwnPropertyDescriptor(self.style, 'timingDelay') && self.style.timingContainer) {
			if (self.style.timingContainer != 'par') {
				self.style.timingContainer = settings.timingContainer;
			}
			
			/* element has already been extended with timing properties */
			if (self.style.timingDelay != settings.timingDelay) self.style.timingDelay = settings.timingDelay;
			if (self.style.timingDuration != settings.timingDuration) self.style.timingDuration = settings.timingDuration;
			if (self.style.timingIterationCount != settings.timingIterationCount) self.style.timingIterationCount = settings.timingIterationCount;
			if (self.style.timingPlayState != settings.timingPlayState) self.style.timingPlayState = settings.timingPlayState;
			if (self.style.timingSyncMaster != settings.timingSyncMaster) self.style.timingSyncMaster = settings.timingSyncMaster;
			
			return null;
		}
		
		/* control properties */
		var voided = false;
		var initiated = false;
		var begun = false;
		var paused = true;
		var ended = false;
		var error = false;
		var waiting = false;
		var canplay = true;
		
		/* presentation properties */
		var dur = settings.timingDuration ? parseFloat(settings.timingDuration) : settings.timingDuration;
		var repeatCount = settings.timingIterationCount == 'infinite' ? 
			9007199254740992 : parseInt(settings.timingIterationCount);
		var repeatInstance = repeatCount;
				
		/* other presentation properties */
		var muted = false;
		var playbackRate = 1.0;
		var currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
		var delayComputed = true;
		
		/* list of items to be played in parallel */
		var itemList = [];
		
		/* mutation observer */
		var observer;
		
		/* start with not active element even before initialization */
		self.setAttribute('tss-state', 'not-active');
		
		/* we need to define this function in the scope of the object */
		function timeUpdateListener(event) {
			event.stopPropagation();
			
			if (event.type == TSS_TIMEUPDATE_EVENT) {
				var newTime = event.detail;
				var delay = settings.timingDelay != null ? (1.0 * parseFloat(settings.timingDelay)) : 0.0;
				currentTime = newTime - delay;
				
				if (begun && currentTime < 0) {
					/* clean the house */
					self.setAttribute('tss-state', 'not-active');
					delayComputed = false;
				}
				
				if (ended && newTime <= delay + dur)
					that.currentTime = newTime - delay;
			}
			else if (begun && !paused) {			/* begun && playing */
				currentTime = currentTime + event.detail/1000.0;
			}
			
			if (!delayComputed && currentTime >=0) {
				delayComputed = true;
				begun = false; 				/* review: is it the best way? */
				that.play;
			}
			
			if (begun && !ended && typeof dur == 'number' && currentTime >= dur) {
				currentTime = 0;
		
				/* we must skip the currItem yieldEvent */
				ended = true;
				for (var i=0;i<itemList.length;i++) {
					itemList[i].style.stop;
				}					
				self.trigger(TSS_END_EVENT);
			}
			
			if (paused) return;
			
			/* notify time update handlers */
			self.trigger(TSS_TIMEUPDATE_EVENT, currentTime);
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_TIMEUPDATE_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
		}
				
		/* 
		 * public events
		 */
		
		var f;
		
		/* play event */
		self.bind(TSS_PLAY_EVENT, f = function(event) {
			event.stopPropagation();
			
			/* make sure it will not be active */
			if (voided) {
				self.unbind(TSS_PLAY_EVENT, f);
				return;
			}
			
			paused = false;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_PLAY_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
			
			if (!begun) {
				begun = true;
				ended = false;
				self.trigger(TSS_BEGIN_EVENT);
			}
		}, false);
		
		/* pause event */
		self.bind(TSS_PAUSE_EVENT, f = function(event) {
			event.stopPropagation();
			
			/* make sure it will not be active */
			if (voided) {
				self.unbind(TSS_PAUSE_EVENT, f);
				return;
			}
			
			paused = true;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_PAUSE_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
		}, false);
	
		/* begin event */
		self.bind(TSS_BEGIN_EVENT, f = function(event) {
			event.stopPropagation();
			
			/* make sure it will not be active */
			if (voided) {
				self.unbind(TSS_BEGIN_EVENT, f);
				return;
			}
			
			if (delayComputed) {
				/* set pseudo-class */
				self.setAttribute('tss-state', 'active');
			}
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_BEGIN_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
		}, false);
		
		/* end event */
		self.bind(TSS_END_EVENT, f = function(event) {
			event.stopPropagation();
			
			/* make sure it will not be active */
			if (voided) {
				self.unbind(TSS_END_EVENT, f);
				return;
			}
			
			paused = true;
			begun = false;
			ended = true;
			waiting = false;
			canplay = true;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_END_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
			
			/* reset the time anyway */
			currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
			
			/* clean the house */
			self.setAttribute('tss-state', 'not-active');
			
			/* does it have a repeatCount? */
			repeatInstance--;
			if (repeatInstance <= 0) {
				/* REVIEW IT */
				settings.timingPlayState = 'paused';
				
				repeatInstance = repeatCount;
				self.trigger(TSS_YIELD_EVENT);
				
				if (!settings.timingSyncMaster) window.tempo.remove(self);
				initiated = false;
				delayComputed = true;
				self.unbind('tempoupdate');
			}
			else that.play;
		}, false);
		
		/* 
		 * private methods
		 */
		 
		/* prepare children */
		var setupItem = function(elem) {
			if (!elem) return;
			
			/* begin event */
			elem.bind(TSS_BEGIN_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_BEGIN_EVENT, this);
					return;
				}
			});
			
			/* play event */
			elem.bind(TSS_PLAY_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_PLAY_EVENT, this);
					return;
				}
				
				if (!paused && begun) return;	/* begun && playing */
				
				/* we should not propagate a pause event */
				return;
			});
			
			/* pause event */
			elem.bind(TSS_PAUSE_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_PAUSE_EVENT, this);
					return;
				}
				
				if (paused) return;
				
				/* we should not propagate a pause event */
				return;
			});
			
			/* end event */
			/* we should look at the yieldEvent instead of the endEvent */
			elem.bind(TSS_YIELD_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_YIELD_EVENT, this);
					return;
				}
				
				if (ended) return;
				
				/* only continues if all children ended */
				for (var i=0;i<itemList.length;i++) {
					if (itemList[i].style.begun && !itemList[i].style.ended) {
						return;
					}
				}
				
				/* all children ended. but we should check one last thing... */
				/* we only trigger this end event if duration has not been defined */
				if (typeof dur != 'number') self.trigger(TSS_END_EVENT);
			});
			
			/* waiting event */
			elem.bind(TSS_WAIT_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_WAIT_EVENT, this);
					return;
				}
				
				waiting = true;
				canplay = false;
				
				/* trigger own waiting event */
				self.trigger(TSS_WAIT_EVENT);
			});
			
			/* canplay event */
			elem.bind(TSS_CAN_PLAY_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_CAN_PLAY_EVENT, this);
					return;
				}
				
				/* only change state if all children can play */
				for (var i=0;i<itemList.length;i++) {
					if (itemList[i].style.waiting) {
						return;
					}
				}
				
				waiting = false;
				canplay = true;
				
				/* trigger own waiting event */
				self.trigger(TSS_CAN_PLAY_EVENT);
			});
		}
		
		/* go through children nodes */
		var validateChildren = function() {
			itemList = [];
			
			if (self.hasChildNodes()) {
				var child = self.firstChild;
				while (child) {
					/* is it a valid element */
					if (child.nodeType === 1 && 
						child.nodeName != 'SCRIPT' &&
						child.nodeName != 'LINK' &&
						child.nodeName != 'STYLE' &&
						child.nodeName != 'SOURCE' &&
						child.nodeName != 'TIME') {
						if (Object.getOwnPropertyDescriptor(child.style, 'timingDelay')) {
							/* element has already been extended with timing properties */
						}
						else {
							var item = parseItem(child, self);
							extend(child.style, item);
						}
						itemList.push(child);
					}
					child = child.nextSibling;
				}
			}
		}
		validateChildren();
		
		for (var i=0;i<itemList.length;i++) {
			var child = itemList[i];
			setupItem(child);
		}
		
		/* new browsers */
		try {
			/* create an observer instance
			   source: https://developer.mozilla.org/en/docs/Web/API/MutationObserver 
			*/
			observer = new MutationObserver(function(mutations) {
				mutations.forEach(function(mutation) {
					var target = mutation.target; /* target node */
					
					switch (mutation.type) {
						case 'childList':
							/* first let's revalidate children nodes */
							validateChildren();
							
							/* now, process new elements */
							for (var i=0; i<mutation.addedNodes.length; i++) {
								var child = mutation.addedNodes[i];
								/* add listeners, but only if it is relevant */
								if (itemList.indexOf(child) >= 0) setupItem(child);
							}
							
							/* process removed elements */
							for (var i=0; i<mutation.removedNodes.length; i++) {
								var child = mutation.removedNodes[i];
							}
							
							/* in case the element is active and playing we need to initialize its new children */
							if (begun && !paused) {
								that.pause;
								that.play;
							}
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
			var config = { attributes: true, childList: true, characterData: true/*, subtree: true*/ };
			
			/* pass in the target node, as well as the observer options */
			observer.observe(self, config);
			
			/* later, you can stop observing */
			/*observer.disconnect();*/
		} catch(e) {
			/* old browsers: deprecated */
			self.addEventListener('DOMNodeInserted', function (ev) {
				/* first let's revalidate children nodes */
				validateChildren();
				
				/* add listeners, but only if it is relevant */
				if (itemList.indexOf(ev.target) >= 0) setupItem(ev.target);
			}, false);
		}
		
		/* 
		 * public methods
		 */
		
		var that = {};
		
		/* we need to init the properties first */
		Object.defineProperty(that, 'timingContainer', {
			get : function() {
				if (voided) return;
				
				return 'par';
			},
			set : function(newValue) {
				if (voided) return;
				
				if (newValue == 'par') return;
				else if (newValue == 'seq') {
					var playState = settings.timingPlayState;
					
					/* stop current */
					this.stop;
					voided = true;
					
					/* create a new container with current settings */
					settings.timingContainer = 'seq';
					var newSeq = new TSSSeq(settings);
					/* replace reference */
					that = newSeq;
					extend(settings.domNode.style, that, true);
					
					that.timingPlayState = playState;
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingDelay', {
			get : function() {
				return settings.timingDelay != null ? (parseFloat(settings.timingDelay)) : 0.0;
			},
			set : function(newValue) { 
				if (newValue == null) return;
				
				settings.timingDelay = newValue != null ? parseFloat(newValue) : 0.0;
				
				if (!begun) currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingDuration', {
			get : function() {
				/* has the duration been explicitly defined? */
				if (dur)
					return dur;
				
				/* no items? */
				if (itemList.length == 0)
					return 'infinite';	/* infinity */
				
				/* if none of the previous, we should compute duration based on its children */
				var maxDur = 0;
				for (var i=0;i<itemList.length;i++) {
					var aux = itemList[i].style.timingDuration;
					if (aux == 'infinite' || maxDur == 'infinite') return 'infinite';
					maxDur = Math.max(maxDur, aux);
				}
				return maxDur;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				dur = newValue == 'infinite' ? 9007199254740992 : parseFloat(newValue);
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingIterationCount', {
			get : function() {
				return repeatCount == 9007199254740992 ? 'infinite' : repeatCount;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				repeatCount = newValue == 'infinite' ? 
					9007199254740992 : parseInt(newValue);
				repeatInstance = repeatCount;
				
				/* test if this should be the last repetition */
				if (repeatCount <= 0 && !paused) {
					this.stop;
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingPlayState', {
			get : function() {
				return settings.timingPlayState;
			},
			set : function(newValue) {
				if (newValue == 'paused') { settings.timingPlayState = newValue; this.pause; }
				else if (newValue == 'running') { settings.timingPlayState = newValue; this.play; }
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingSyncMaster', {
			get : function() {
				return settings.timingSyncMaster;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				/* todo */
			},
			enumerable: true,
			configurable: true
 		});
 		
 		/* non-standard properties (implementation dependent) */
 		
 		/* init method */
		Object.defineProperty(that, 'initialize', {
			get : function() {
				if (initiated)
					return;
				
				self.setAttribute('tss-state', 'not-active');
				
				var that = this;
				self.bind('tempoupdate', timeUpdateListener, true);
				
				/* Oops, it has a sync master */
				if (settings.timingSyncMaster) {
					try {
						findSyncMaster(settings.timingSyncMaster).bind(TSS_TIMEUPDATE_EVENT, timeUpdateListener);
					} catch (e) {}
				}
				/* otherwise, register to external updates */
				else window.tempo.add(self);
				
				initiated = true;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		 		
 		/* destroy command */
 		Object.defineProperty(that, 'destroy', {
			get : function() {
				if (initiated) {
					window.tempo.remove(self);
					
					for (var i=0;i<itemList.length;i++) {
						itemList[i].style.destroy;
					}
				}
				
				self.unbind(TSS_PLAY_EVENT + ' ' + TSS_PAUSE_EVENT + ' ' + TSS_BEGIN_EVENT + ' ' + TSS_END_EVENT + ' ' + 'tempoupdate' + ' ' + TSS_YIELD_EVENT);
				
				return delete self;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		/* play command */
 		Object.defineProperty(that, 'play', {
			get : function() {
				if (begun && !paused)		/* begun && playing */
					return;
				
				/* do we need to restart all children? */
				var restart = ended;
				/* has it been initialized? */
				this.initialize;
				
				/* element should stay paused */
				if (!ended && settings.timingPlayState == 'paused') return;
				/* REVIEW IT */
				else settings.timingPlayState = 'running';
				
				if (currentTime < 0) {
					delayComputed = false;
				}
				
				self.trigger(TSS_PLAY_EVENT);
				
				/* play children only after initial delay */
				if (delayComputed) {
					/* all children ended? */
					var allEnded = true;
					for (var i=0;i<itemList.length;i++) {
						if (itemList[i].style.begun && !itemList[i].style.ended) {
							allEnded = false;
							break;
						}
					}
					
					for (var i=0;i<itemList.length;i++) {
						if (!itemList[i].style.ended || restart || 
							(allEnded && (typeof dur != 'number' || currentTime < dur))) itemList[i].style.play;
					}
				}
			},
			set : function(force) {},
			enumerable: true,
			configurable: true
 		});
		
		/* pause command */
 		Object.defineProperty(that, 'pause', {
			get : function() {
				if (paused) return;
				
				self.trigger(TSS_PAUSE_EVENT);
				
				for (var i=0;i<itemList.length;i++) {
					itemList[i].style.pause;
				}
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		/* stop command */
 		Object.defineProperty(that, 'stop', {
			get : function() {
				if (!begun)
					return;
				
				if (!ended) {
					repeatInstance = -1;
					self.trigger(TSS_END_EVENT);
					
					for (var i=0;i<itemList.length;i++) {
						itemList[i].style.stop;
					}
				}
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'begun', {
			get : function() {
				return begun;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'ended', {
			get : function() {
				return ended;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'playing', {
			get : function() {
				return !paused;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
		Object.defineProperty(that, 'paused', {
			get : function() {
				return paused;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'waiting', {
			get : function() {
				return waiting;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'canplay', {
			get : function() {
				return canplay;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'currentTime', {
			get : function() {
				return currentTime;
			},
			set : function(t) {
				/* is it playing? If not, we need to play first */
				if (!begun || ended) {
					this.play;
					this.pause;
				}
				
				t = parseFloat(t);
				
				if (typeof t == 'number' && !isNaN(t)) {
					currentTime = t;
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		return that;
	}
	
	TSSSeq = function(options) {
		/* default options */
		var settings = extend(options, {
			timingDelay:			null,
			timingDuration:			null,
			timingIterationCount:	1,
			timingPlayState:		null,
			timingSyncMaster:		null,
			domNode:				null,
			parent:					null
		});
		
		/* 
		 * private variables 
		 */
		
		/* keep self reference */
		var self = settings.domNode;
		
		/* before doing anything, test wether this node has already been instantiated */
		if (Object.getOwnPropertyDescriptor(self.style, 'timingDelay') && self.style.timingContainer) {
			if (self.style.timingContainer != 'seq') {
				self.style.timingContainer = settings.timingContainer;
			}
			
			/* element has already been extended with timing properties */
			if (self.style.timingDelay != settings.timingDelay) self.style.timingDelay = settings.timingDelay;
			if (self.style.timingDuration != settings.timingDuration) self.style.timingDuration = settings.timingDuration;
			if (self.style.timingIterationCount != settings.timingIterationCount) self.style.timingIterationCount = settings.timingIterationCount;
			if (self.style.timingPlayState != settings.timingPlayState) self.style.timingPlayState = settings.timingPlayState;
			if (self.style.timingSyncMaster != settings.timingSyncMaster) self.style.timingSyncMaster = settings.timingSyncMaster;
			
			return null;
		}
		
		/* control properties */
		var voided = false;
		var initiated = false;
		var begun = false;
		var paused = true;
		var ended = false;
		var error = false;
		var waiting = false;
		var canplay = true;
		
		/* presentation properties */
		var dur = settings.timingDuration ? parseFloat(settings.timingDuration) : settings.timingDuration;
		var repeatCount = settings.timingIterationCount == 'infinite' ? 
			9007199254740992 : parseInt(settings.timingIterationCount);
		var repeatInstance = repeatCount;
		
		/* other presentation properties */
		var muted = false;
		var playbackRate = 1.0;
		var currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
		var delayComputed = true;
		
		/* list of items to be played in parallel */
		var itemList = [];
		/* index of current being played */
		var itemIndex = -1;
		/* current item being played */
		var currItem = null;
		
		/* mutation observer */
		var observer;
		
		/* start with not active element even before initialization */
		self.setAttribute('tss-state', 'not-active');
		
		/* we need to define this function in the scope of the object */
		function timeUpdateListener(event) {
			event.stopPropagation();
			
			if (event.type == TSS_TIMEUPDATE_EVENT) {
				var newTime = event.detail;
				var delay = settings.timingDelay != null ? (1.0 * parseFloat(settings.timingDelay)) : 0.0;
				currentTime = newTime - delay;
				
				if (begun && currentTime < 0) {
					/* clean the house */
					self.setAttribute('tss-state', 'not-active');
					delayComputed = false;
				}
				
				if (ended && newTime <= delay + dur)
					that.currentTime = newTime - delay;
			}
			else if (begun && !paused) {			/* begun && playing */
				currentTime = currentTime + event.detail/1000.0;
			}
			
			if (!delayComputed && currentTime >=0) {
				delayComputed = true;
				begun = false; 				/* review: is it the best way? */
				that.play;
			}
			
			if (begun && !ended && typeof dur == 'number' && currentTime >= dur) {
				currentTime = 0;
				
				/* we must skip the currItem yieldEvent */
				ended = true;
				if (currItem) currItem.style.stop;				
				self.trigger(TSS_END_EVENT);
			}
			
			if (paused) return;
			
			/* notify time update handlers */
			self.trigger(TSS_TIMEUPDATE_EVENT, currentTime);
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_TIMEUPDATE_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
		}
		
		/* 
		 * public events
		 */
		
		var f;
		
		/* play event */
		self.bind(TSS_PLAY_EVENT, f = function(event) {
			event.stopPropagation();
			
			/* make sure it will not be active */
			if (voided) {
				self.unbind(TSS_PLAY_EVENT, f);
				return;
			}
			
			paused = false;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_PLAY_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
			
			if (!begun) {
				begun = true;
				ended = false;
				self.trigger(TSS_BEGIN_EVENT);
			}
		}, false);
	
		/* pause event */
		self.bind(TSS_PAUSE_EVENT, f = function(event) {
			event.stopPropagation();
			
			/* make sure it will not be active */
			if (voided) {
				self.unbind(TSS_PAUSE_EVENT, f);
				return;
			}
			
			paused = true;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_PAUSE_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
		}, false);
	
		/* begin event */
		self.bind(TSS_BEGIN_EVENT, f = function(event) {
			event.stopPropagation();
			
			/* make sure it will not be active */
			if (voided) {
				self.unbind(TSS_BEGIN_EVENT, f);
				return;
			}
			
			if (delayComputed) {
				/* set pseudo-class */
				self.setAttribute('tss-state', 'active');
			}
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_BEGIN_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
		}, false);
	
		/* end event */
		self.bind(TSS_END_EVENT, f = function(event) {
			event.stopPropagation();
			
			/* make sure it will not be active */
			if (voided) {
				self.unbind(TSS_END_EVENT, f);
				return;
			}
			
			paused = true;
			begun = false;
			ended = true;
			waiting = false;
			canplay = true;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_END_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
			
			/* reset the time anyway */
			currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
			
			/* clean the house */
			self.setAttribute('tss-state', 'not-active');
			
			/* does it have a repeatCount? */
			repeatInstance--;
			if (repeatInstance <= 0) {
				/* REVIEW IT */
				settings.timingPlayState = 'paused';
				
				repeatInstance = repeatCount;
				self.trigger(TSS_YIELD_EVENT);
				
				if (!settings.timingSyncMaster) window.tempo.remove(self);
				initiated = false;
				delayComputed = true;
				itemIndex = -1;
				currItem = null;
				self.unbind('tempoupdate');
			}
			else {
				/* go back to square one */
				currItem = null;
				that.play;
			}
		}, false);
		
		/* 
		 * private methods
		 */
		
		/* return the index of the current item */
		var getCurrItemIndex = function() {
			return itemIndex;
		}
		
		/* return the index of a given item */
		var getItemIndex = function(item) {
			for(var i=0;i<itemList.length;i++) {
				if (itemList[i] == item)
					return i;
			}
			return -1;
		}
		
		/* prepare children */
		var setupItem = function(elem) {
			var item = elem;
			
			if (!elem) return;
			
			/* begin event */
			elem.bind(TSS_BEGIN_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_BEGIN_EVENT, this);
					return;
				}
			});
			
			/* play event */
			elem.bind(TSS_PLAY_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_PLAY_EVENT, this);
					return;
				}
				
				/* first item. Just in case we play this item instead of container */
				if (!begun) {
					itemIndex = getItemIndex(item);
					currItem = itemList[itemIndex];
				} 
				
				itemIndex = getItemIndex(item);
				currItem = itemList[itemIndex];
				
				for(var i=0;i<itemList.length;i++) {
					if (i != itemIndex && itemList[i].style.playing) {
						itemList[i].style.stop;
					}
				}
				
				if (paused) self.trigger(TSS_PLAY_EVENT);
			});
		
			/* pause event */
			elem.bind(TSS_PAUSE_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_PAUSE_EVENT, this);
					return;
				}
				
				/* we should not propagate a pause event */
				/*if (!paused) self.trigger(TSS_PAUSE_EVENT);*/
			});
			
			/* end event */
			/* we should look at the yieldEvent instead of the endEvent */
			elem.bind(TSS_YIELD_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_YIELD_EVENT, this);
					return;
				}
				
				if (ended) return;
				
				/* what a hack: did it end by itself? */
				if (getCurrItemIndex() != getItemIndex(item)) {
					/* get me out of here */
					return;
				}
				
				/* last item */
				if (getCurrItemIndex() == itemList.length - 1) {
					itemIndex = -1;
					currItem = null;
					
					/* we only trigger this end event if duration has not been defined */
					if (typeof dur != 'number') self.trigger(TSS_END_EVENT);
				}
				/* all the other items */
				else {
					itemIndex = itemIndex + 1;
					currItem = itemList[itemIndex];
					if (currItem.style.paused) currItem.style.play;
				}
			});
			
			/* waiting event */
			elem.bind(TSS_WAIT_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_WAIT_EVENT, this);
					return;
				}
				
				waiting = true;
				canplay = false;
				
				/* trigger own waiting event */
				self.trigger(TSS_WAIT_EVENT);
			});
			
			/* canplay event */
			elem.bind(TSS_CAN_PLAY_EVENT, function(event) {
				event.stopPropagation();
				
				/* make sure it will not be active */
				if (voided) {
					self.unbind(TSS_CAN_PLAY_EVENT, this);
					return;
				}
				
				/* only change state if this is the current item triggered the event */
				if (getCurrItemIndex() != getItemIndex(item)) {
					/* get me out of here */
					return;
				}
				
				waiting = false;
				canplay = true;
				
				/* trigger own waiting event */
				self.trigger(TSS_CAN_PLAY_EVENT);
			});
		}
		
		/* go through children nodes */
		var validateChildren = function() {
			itemList = [];
			
			if (self.hasChildNodes()) {
				var child = self.firstChild;
				while (child) {
					/* is it a valid element */
					if (child.nodeType === 1 && 
						child.nodeName != 'SCRIPT' &&
						child.nodeName != 'LINK' &&
						child.nodeName != 'STYLE' &&
						child.nodeName != 'SOURCE' &&
						child.nodeName != 'TIME') {
						if (Object.getOwnPropertyDescriptor(child.style, 'timingDelay')) {
							/* element has already been extended with timing properties */
						}
						else {
							var item = parseItem(child, self);
							extend(child.style, item);
						}
						itemList.push(child);
					}
					child = child.nextSibling;
				}
			}
		}
		validateChildren();
		
		for (var i=0;i<itemList.length;i++) {
			var child = itemList[i];
			setupItem(child);
		}
		
		/* new browsers */
		try {
			/* create an observer instance
			   source: https://developer.mozilla.org/en/docs/Web/API/MutationObserver 
			*/
			observer = new MutationObserver(function(mutations) {
				mutations.forEach(function(mutation) {
					var target = mutation.target; /* target node */
					
					switch (mutation.type) {
						case 'childList':
							/* first let's revalidate children nodes */
							validateChildren();
							
							/* now, process new elements */
							for (var i=0; i<mutation.addedNodes.length; i++) {
								var child = mutation.addedNodes[i];
								/* add listeners, but only if it is relevant */
								if (itemList.indexOf(child) >= 0) setupItem(child);
							}
							
							/* process removed elements */
							for (var i=0; i<mutation.removedNodes.length; i++) {
								var child = mutation.removedNodes[i];
							}
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
			var config = { attributes: true, childList: true, characterData: true/*, subtree: true*/ };
			
			/* pass in the target node, as well as the observer options */
			observer.observe(self, config);
			
			/* later, you can stop observing */
			/*observer.disconnect();*/
		} catch(e) {
			/* old browsers: deprecated */
			self.addEventListener('DOMNodeInserted', function (ev) {
				/* first let's revalidate children nodes */
				validateChildren();
				
				/* add listeners, but only if it is relevant */
				if (itemList.indexOf(ev.target) >= 0) setupItem(ev.target);
			}, false);
		}
		
		/* 
		 * public methods
		 */		
		
		var that = {};
		
		/* we need to init the properties first */
		Object.defineProperty(that, 'timingContainer', {
			get : function() {
				if (voided) return;
				
				return 'seq';
			},
			set : function(newValue) {
				if (voided) return;
				
				if (newValue == 'seq') return;
				else if (newValue == 'par') {
					var playState = settings.timingPlayState;
					
					/* stop current */
					this.stop;
					voided = true;
					
					/* create a new container with current settings */
					settings.timingContainer = 'par';
					var newPar = new TSSPar(settings);
					/* replace reference */
					that = newPar;
					extend(settings.domNode.style, that, true);
					
					that.timingPlayState = playState;
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingDelay', {
			get : function() {
				return settings.timingDelay != null ? (parseFloat(settings.timingDelay)) : 0.0;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				settings.timingDelay = newValue != null ? parseFloat(newValue) : 0.0;
				
				if (!begun) currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingDuration', {
			get : function() {
				/* has the duration been explicitly defined? */
				if (dur)
					return dur;
				
				/* no items? */
				if (itemList.length == 0)
					return 9007199254740992;	/* infinity */
				
				/* if none of the previous, we should compute duration based on its children */
				var childrenDur = 0;
				for (var i=0; i<itemList.length; i++) {
					var aux = itemList[i].style.timingDuration;
					if (aux == 'infinite') return aux;
					childrenDur += aux;
				}
				return childrenDur;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				dur = newValue == 'infinite' ? 9007199254740992 : parseFloat(newValue);
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingIterationCount', {
			get : function() {
				return repeatCount == 9007199254740992 ? 'infinite' : repeatCount;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				repeatCount = newValue == 'infinite' ? 
					9007199254740992 : parseInt(newValue);
				repeatInstance = repeatCount;
				
				/* test if this should be the last repetition */
				if (repeatCount <= 0 && !paused) {
					this.stop;
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingPlayState', {
			get : function() {
				return settings.timingPlayState;
			},
			set : function(newValue) {
				if (newValue == 'paused') { settings.timingPlayState = newValue; this.pause; }
				else if (newValue == 'running') { settings.timingPlayState = newValue; this.play; }
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingSyncMaster', {
			get : function() {
				return settings.timingSyncMaster;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				/* todo */
			},
			enumerable: true,
			configurable: true
 		});
 		
 		/* non-standard properties (implementation dependent) */
 		
		/* init method */
		Object.defineProperty(that, 'initialize', {
			get : function() {
				if (initiated)
					return;
				
				self.setAttribute('tss-state', 'not-active');
				
				var that = this;
				self.bind('tempoupdate', timeUpdateListener);
				
				/* Oops, it has a sync master */
				if (settings.timingSyncMaster) {
					try {
						findSyncMaster(settings.timingSyncMaster).bind(TSS_TIMEUPDATE_EVENT, timeUpdateListener);
					} catch (e) {}
				}
				/* register to external updates */
				else window.tempo.add(self);
				
				initiated = true;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		/* destroy command */
 		Object.defineProperty(that, 'destroy', {
			get : function() {
				if (initiated) {
					window.tempo.remove(self);
					
					for (var i=0;i<itemList.length;i++) {
						itemList[i].style.destroy;
					}
				}
			
				self.unbind(TSS_PLAY_EVENT + ' ' + TSS_PAUSE_EVENT + ' ' + TSS_BEGIN_EVENT + ' ' + TSS_END_EVENT + ' ' + 'tempoupdate' + ' ' + TSS_YIELD_EVENT);
				
				return delete self;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		/* play command */
 		Object.defineProperty(that, 'play', {
			get : function() {
				if (begun && !paused)		/* begun && playing */
					return;
				
				/* has it been initialized? */
				this.initialize;
				
				/* element should stay paused */
				if (!ended && settings.timingPlayState == 'paused') return;
				/* REVIEW IT */
				else settings.timingPlayState = 'running';
				
				if (currentTime < 0) {
					delayComputed = false;
				}
				
				self.trigger(TSS_PLAY_EVENT);
				
				/* play children only after initial delay */
				if (delayComputed) {
					
					if (itemList.length > 0) {
						/* do we have a current item? */
						if (!currItem) {
							itemIndex = 0;
							currItem = itemList[itemIndex];
						}
						
						currItem.style.play;
					}
				}
			},
			set : function(force) {},
			enumerable: true,
			configurable: true
 		});
 		
 		/* pause command */
 		Object.defineProperty(that, 'pause', {
			get : function() {
				self.trigger(TSS_PAUSE_EVENT);
				
				if (currItem) currItem.style.pause;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		/* stop command */
 		Object.defineProperty(that, 'stop', {
			get : function() {
				if (!begun)
					return;
				
				if (!ended) {
					var item = currItem;
					repeatInstance = -1;
					self.trigger(TSS_END_EVENT);
					
					if (item) item.style.stop;
				}
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'begun', {
			get : function() {
				return begun;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'ended', {
			get : function() {
				return ended;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'playing', {
			get : function() {
				return !paused;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'paused', {
			get : function() {
				return paused;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'waiting', {
			get : function() {
				return waiting;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'canplay', {
			get : function() {
				return canplay;
			},
			set : function() {},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'currentTime', {
			get : function() {
				return currentTime;
			},
			set : function(t) {
				/* is it playing? If not, we need to play first */
				if (!begun || ended) {
					this.play;
					this.pause;
				}
				
				t = parseFloat(t);
				
				if (typeof t == 'number' && !isNaN(t)) {
					currentTime = t;
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		return that;
	}
	
	TSSMedia = function(options) {
		/* default options */
		var settings = extend(options, {
			timingDelay:			null,
			timingDuration:			null,
			timingIterationCount:	1,
			timingPlayState:		null,
			timingClipBegin:		0,
			timingClipEnd:			9007199254740992, /* infinity */
			timingVolume:			null,
			timingSyncMaster:		null,
			domNode:				null,
			parent:					null
		});
		
		/* 
		 * private variables 
		 */
		
		/* keep self reference */
		var self = settings.domNode;
		
		/* before doing anything, test wether this node has already been instantiated */
		if (Object.getOwnPropertyDescriptor(self.style, 'timingDelay')) {
			/* element has already been extended with timing properties */
			if (self.style.timingDelay != settings.timingDelay) self.style.timingDelay = settings.timingDelay;
			if (self.style.timingDuration != settings.timingDuration) self.style.timingDuration = settings.timingDuration;
			if (self.style.timingIterationCount != settings.timingIterationCount) self.style.timingIterationCount = settings.timingIterationCount;
			if (self.style.timingPlayState != settings.timingPlayState) self.style.timingPlayState = settings.timingPlayState;
			if (self.style.timingSyncMaster != settings.timingSyncMaster) self.style.timingSyncMaster = settings.timingSyncMaster;
			
			return null;
		}
		
		/* control properties */
		var initiated = false;
		var begun = false;
		var paused = true;
		var ended = false;
		var error = false;
		var waiting = false;
		var canplay = true;
		
		/* media type: continuous (0) or discrete (1) */
		var media_type = settings.domNode.nodeType === 1 && 
						(settings.domNode.nodeName == 'VIDEO' || 
						settings.domNode.nodeName == 'AUDIO') ? 0 : 1;
		
		/* presentation properties */
		var clipBegin = parseFloat(settings.timingClipBegin);
		var clipEnd = parseFloat(settings.timingClipEnd);
		var dur = settings.timingDuration ? 
				parseFloat(settings.timingDuration) : 
				media_type == 1 ? 									/* is discrete? */
					9007199254740992 :								/* infinity */
					typeof clipBegin == 'number' && typeof clipEnd == 'number' ?
						clipEnd - clipBegin : 9007199254740992;		/* infinity */
		var repeatCount = settings.timingIterationCount == 'infinite' ? 
			9007199254740992 : parseInt(settings.timingIterationCount);
		var repeatInstance = repeatCount;
		
		/* other presentation properties */
		var muted = false;
		var volume = settings.timingVolume ? parseFloat(settings.timingVolume) : null;
		var playbackRate = 1.0;
		var currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
		var delayComputed = true;
		
		/* start with not active element even before initialization */
		self.setAttribute('tss-state', 'not-active');
		
		/* we need to define this function in the scope of the object */
		function timeUpdateListener(event) {
			event.stopPropagation();
			
			if (media_type == 0) {
				this.currentTime = event.detail;
			}
			else {
				if (event.type == TSS_TIMEUPDATE_EVENT) {
					var newTime = event.detail;
					var delay = settings.timingDelay != null ? (1.0 * parseFloat(settings.timingDelay)) : 0.0;
					currentTime = newTime - delay;
					
					if (begun && currentTime < 0) {
						/* clean the house */
						self.setAttribute('tss-state', 'not-active');
						delayComputed = false;
					}
					
					if (ended && newTime <= delay + dur)
						that.currentTime = newTime - delay;
				}
				/* this is a tempoupdate event */
				else if ((begun && !paused)) {		/* begun && playing */
					currentTime = currentTime + event.detail/1000.0;
				}
				
				if (!delayComputed && currentTime >= 0) {
					delayComputed = true;
					/* unregister right away if it is continuous media */
					if (media_type == 0) window.tempo.remove(self);
					begun = false; 				/* review: is it the best way for the delay? */
					that.play;
				}
				
				if (begun && !ended && currentTime >= dur) {
					currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
					self.trigger(TSS_END_EVENT);
				}
				
				if (paused) return;
				
				/* notify time update handlers */
				self.trigger(TSS_TIMEUPDATE_EVENT, currentTime);
				
				/* is there an event attribute? If so, let's run it */
				var evtAttr = self.getAttribute(TSS_TIMEUPDATE_EVENT);
				if (evtAttr) {
					try {
						eval(evtAttr);
					} catch (e) {}
				}
			}
		}
		
		/*
		 * public events
		 */
		 
		/* play event */
		self.bind(TSS_PLAY_EVENT, function(event) {
			event.stopPropagation();
			
			paused = false;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_PLAY_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
			
			if (!begun) {
				begun = true;
				ended = false;
				self.trigger(TSS_BEGIN_EVENT);
			}
		}, false);
		
		/* pause event */
		self.bind(TSS_PAUSE_EVENT, function(event) {
			event.stopPropagation();
			
			if (canplay) paused = true;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_PAUSE_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
		}, false);
		
		/* begin event */
		self.bind(TSS_BEGIN_EVENT, function(event) {
			event.stopPropagation();
			
			if (delayComputed) {
				/* set volume on begin. It will affect continuous media */
				if (volume) that.volume = volume;
				/* set pseudo-class */
				self.setAttribute('tss-state', 'active');
			}
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_BEGIN_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
		}, false);
		
		/* end event */
		self.bind(TSS_END_EVENT, function(event) {
			event.stopPropagation();
			
			paused = true;
			begun = false;
			ended = true;
			
			/* is there an event attribute? If so, let's run it */
			var evtAttr = self.getAttribute(TSS_END_EVENT);
			if (evtAttr) {
				try {
					eval(evtAttr);
				} catch (e) {}
			}
			
			/* reset the time anyway */
			currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
			
			/* clean the house */
			self.setAttribute('tss-state', 'not-active');
			
			/* does it have a repeatCount? */
			repeatInstance--;
			if (repeatInstance <= 0) {
				/* REVIEW IT */
				settings.timingPlayState = 'paused';
				/* canplay = false;*/
				waiting = false;
				
				repeatInstance = repeatCount;
				
				/*self.unbind('play pause ended timeupdate');*/
				/*if (settings.timingSyncMaster) 
					findSyncMaster(settings.timingSyncMaster).unbind(TSS_TIMEUPDATE_EVENT, timeUpdateListener);*/
				if (!settings.timingSyncMaster)  window.tempo.remove(self);
				initiated = false;
				delayComputed = true;
				self.unbind('tempoupdate');
				
				self.trigger(TSS_YIELD_EVENT);
			}
			else {
				canplay = true;
				waiting = false;
				that.play;
			}
		}, false);
		
		/*
		 * public methods
		 */
		
		/* public methods */
		var that = {};
		
		/* we need to init the properties first */ 		
 		Object.defineProperty(that, 'timingDelay', {
			get : function() {
				return settings.timingDelay != null ? (parseFloat(settings.timingDelay)) : 0.0;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				settings.timingDelay = newValue != null ? parseFloat(newValue) : 0.0;
				
				if (!begun) currentTime = settings.timingDelay != null ? (-1.0 * parseFloat(settings.timingDelay)) : 0.0;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingDuration', {
			get : function() {
				/* continuous media */
				if (media_type == 0)
					return Math.min(dur, self.duration - clipBegin);
				else return dur;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				dur = newValue == 'infinite' ? 9007199254740992 : parseFloat(newValue);
				settings.timingDuration = dur; 
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingIterationCount', {
			get : function() {
				return repeatCount == 9007199254740992 ? 'infinite' : repeatCount;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				repeatCount = newValue == 'infinite' ? 
					9007199254740992 : parseInt(newValue);
				repeatInstance = repeatCount;
				
				/* test if this should be the last repetition */
				if (repeatCount <= 0 && !paused) {
					this.stop;
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingPlayState', {
			get : function() {
				return settings.timingPlayState;
			},
			set : function(newValue) {
				if (newValue == 'paused') { settings.timingPlayState = newValue; this.pause; }
				else if (newValue == 'running') { settings.timingPlayState = newValue; this.play; }
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingClipBegin', {
			get : function() {
				return clipBegin;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				settings.timingClipBegin = newValue;
				clipBegin = parseFloat(settings.timingClipBegin);
				if (media_type == 0 && !settings.timingDuration && clipEnd) {
					dur = typeof clipBegin == 'number' && typeof clipEnd == 'number' ?
							clipEnd - clipBegin : 9007199254740992;		/* infinity */
					
					/* set current time to clip begin */
					if (!begun) that.currentTime = clipBegin; 
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingClipEnd', {
			get : function() {
				return clipEnd;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				settings.timingClipEnd = newValue;
				clipEnd = parseFloat(settings.timingClipEnd);
				if (media_type == 0 && !settings.timingDuration && clipEnd) {
					dur = typeof clipBegin == 'number' && typeof clipEnd == 'number' ?
							clipEnd - clipBegin : 9007199254740992;		/* infinity */
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingVolume', {
			get : function() {
				return volume;
			},
			set : function(v) {
				if (newValue == null) return;
				
				v = parseFloat(v);
				
				if (typeof v == 'number' && !isNaN(v)) {
					volume = v;
					settings.timingVolume = v;
					
					/* continuous media */
					if (media_type == 0 && initiated) {
						self.volume = v;
					}
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'timingSyncMaster', {
			get : function() {
				return settings.timingSyncMaster;
			},
			set : function(newValue) {
				if (newValue == null) return;
				
				/* todo */
			},
			enumerable: true,
			configurable: true
 		});
 		
 		/* non-standard properties (implementation dependent) */
 		
		/* init method */
		Object.defineProperty(that, 'initialize', {
			get : function() {
				canplay = true;
				
				if (initiated)
					return;
				
				self.setAttribute('tss-state', 'not-active');
				
				/* continuous media */
				if (media_type == 0) {
					var that = this;
					
					/* specific events */
					self.bind('play', function(event) {
						event.stopPropagation();
						
						if (!canplay) {
							self.pause();
							that.play;
						}
						
						/* element should be running */
						if (settings.timingPlayState == 'paused')
							settings.timingPlayState = 'running';
						
						if (paused) self.trigger(TSS_PLAY_EVENT);
					}, true);
					
					self.bind('pause', function(event) {
						event.stopPropagation();
						
						/* what a hack: pause event might be triggered before end event */
						if (self.ended)
							return;
							
						if (!paused) self.trigger(TSS_PAUSE_EVENT);
					}, true);
					
					self.bind('ended', function(event) {
						event.stopPropagation();
						
						if (!ended) {
							self.currentTime = clipBegin;
							self.trigger(TSS_END_EVENT);
						}
					}, true);
					
					self.bind('timeupdate', function(event) {
						event.stopPropagation();
						
						if (paused || !delayComputed) return;
						
						try {
							if (self.currentTime < clipBegin) {
								self.currentTime = clipBegin;
							}
						} catch (e) {}
						
						if (self.currentTime >= clipBegin + dur ||
							self.currentTime >= clipEnd) {
							
							/* we need to indicate to the pause event it should not be triggered. */
							ended = true;
							paused = true;
							
							self.pause();
							self.currentTime = clipBegin;
							self.trigger(TSS_END_EVENT);
						}
						
						if (!ended && delayComputed) currentTime = self.currentTime;
						
						/* notify time update handlers */
						self.trigger(TSS_TIMEUPDATE_EVENT, currentTime);
						
						/* is there an event attribute? If so, let's run it */
						var evtAttr = self.getAttribute(TSS_TIMEUPDATE_EVENT);
						if (evtAttr) {
							try {
								eval(evtAttr);
							} catch (e) {}
						}
					}, true);
					
					self.bind('seeking', function(event) {
						event.stopPropagation();
						
						currentTime = self.currentTime;
						
						/* notify time update handlers */
						self.trigger(TSS_TIMEUPDATE_EVENT, self.currentTime);
					});
					
					/* Oops, it has a sync master */
					if (settings.timingSyncMaster) {
						try {
							findSyncMaster(settings.timingSyncMaster).bind(TSS_TIMEUPDATE_EVENT, timeUpdateListener);
						} catch (e) {}
					}
				}
				
				/* discrete media */
				if (media_type == 1 || currentTime < 0.0) {
					var that = this;
					self.bind('tempoupdate', timeUpdateListener, true);
					
					/* Oops, it has a sync master */
					if (settings.timingSyncMaster) {
						try {
							findSyncMaster(settings.timingSyncMaster).bind(TSS_TIMEUPDATE_EVENT, timeUpdateListener);
						} catch (e) {}
					}
					/* otherwise, register to tempo updates */
					else window.tempo.add(self);
				}
								
				initiated = true;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		/* destroy command */
 		Object.defineProperty(that, 'destroy', {
			get : function() {
				if (initiated) {
					window.tempo.remove(self);
					if (self) self.remove();
				}
				
				self.unbind(TSS_PLAY_EVENT + ' ' + TSS_PAUSE_EVENT + ' ' + TSS_BEGIN_EVENT + ' ' + TSS_END_EVENT + ' ' + 'tempoupdate' + ' ' + TSS_YIELD_EVENT);
				
				delete self;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'play', {
			get : function() {
				if (begun && !paused) /* begun && playing */
					return;
				
				/* has it been initialized? */
				this.initialize;
				
				/* if play state is not defined we should follow the same HTML5 behavior 
				   with no autoplay attribute
				*/
				if (media_type == 0 && !settings.timingPlayState) {
					settings.timingPlayState = 'paused';
				}
				
				/* element should stay paused */
				if (!ended && settings.timingPlayState == 'paused') return;
				/* REVIEW IT */
				else settings.timingPlayState = 'running';
				
				if (canplay) {
					if (currentTime >= 0) {
						/* continuous media? */
						if (media_type == 0) {
							self.trigger(TSS_PLAY_EVENT);
							self.play();
						}
						else self.trigger(TSS_PLAY_EVENT);
					}
					/* compute delay */
					else {
						delayComputed = false;
						/* it starts all state variables but only plays after delay ends */
						self.trigger(TSS_PLAY_EVENT);
					}
				}
				else {
					/* we need to wait to load media item */
					waiting = true;
					self.trigger(TSS_PAUSE_EVENT);
					self.trigger(TSS_WAIT_EVENT);
				}
			},
			set : function(force) {},
			enumerable: true,
			configurable: true
 		});
		
		Object.defineProperty(that, 'pause', {
			get : function() {
				if (!begun || (begun && paused)) /* begun && paused */
					return;
				
				waiting = false;
				
				/* continuous media will trigger pauseEvent by itself */
				if (media_type == 0 && delayComputed) {
					self.pause();
				}
				else if (!paused) self.trigger(TSS_PAUSE_EVENT);
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'stop', {
			get : function() {
				if (!begun)
					return;
				
				if (media_type == 0) {
					try {
						self.pause();
						self.currentTime = clipBegin;
					} catch(e) {}
				}
				
				if (!ended) {
					repeatInstance = -1;
					self.trigger(TSS_END_EVENT);
				}
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'begun', {
			get : function() {
				return begun;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'ended', {
			get : function() {
				return ended;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'playing', {
			get : function() {
				return !paused;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'paused', {
			get : function() {
				return paused;
			},
			enumerable: true,
			configurable: true
 		});
		
		Object.defineProperty(that, 'waiting', {
			get : function() {
				return waiting;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'canplay', {
			get : function() {
				return canplay;
			},
			enumerable: true,
			configurable: true
 		});
 		
 		Object.defineProperty(that, 'volume', {
			get : function() {
				return volume;
			},
			set : function(v) {
				v = parseFloat(v);
				
				if (typeof v == 'number' && !isNaN(v)) {
					volume = v;
					
					/* continuous media */
					if (media_type == 0 && initiated) {
						self.volume = v;
					}
				}
			},
			enumerable: true,
			configurable: true
 		});
		
		Object.defineProperty(that, 'currentTime', {
			get : function() {
				return currentTime;
			},
			set : function(t) {
				/* is it playing? If not, we need to play first */
				if (!begun || ended) {
					this.play;
					this.pause;
				}
				
				t = parseFloat(t);
				
				if (typeof t == 'number' && !isNaN(t)) {
					currentTime = t;
					
					/* continuous media */
					if (media_type == 0 && initiated) {
						self.currentTime = t;
					}
				}
			},
			enumerable: true,
			configurable: true
 		});
		
		/* we need to start listeners from the beginning. Continous media can be started by user interaction */
		if (media_type == 0) {
			that.initialize;
		}
		
		return that;
	}

	/**
	 * listen to the ontssparserready event and then add time style to body element.
	 *
	 * @method
	 * @listens tssParser#ontssparserready
	 */
	document.addEventListener('ontssparserready', function(e) {
		if (!e.detail) { /* detail is filled only when styles are added dynamically */
			/* start timers to track how long the time renderer execution takes */
			try {
				/* http://www.html5rocks.com/en/tutorials/webperformance/usertiming/ */
				window.performance.mark('tss_renderer_time');
			} catch (e) {
				console.time('calculating tss_renderer_time.js execution time');
			}
			
			var options = extend(window.tss(document.body), 
				{
					timingContainer : 'par',
					timingPlayState : 'running',
					dur : 'infinite',
					domNode : document.body
				});
			extend(document.body.style, new TSSPar(options));
			
			/* stop timers that were previously started by calling console.time() and User Timing API */
			try {
				window.performance.measure('tss_renderer_time');
				console.log('calculating tss_renderer_time.js execution time: ' +
							(window.performance.getEntriesByType('measure')[1].duration
							- window.performance.getEntriesByType('mark')[1].startTime).toPrecision(5) + "ms");
			} catch (e) {
				console.timeEnd('calculating tss_renderer_time.js execution time');
			}

			if (document.body.style.timingPlayState != 'paused') document.body.style.play;
		} else {
			var elems = document.getElementsByTagName('*');
			var runningElems = new Array();
			var pausedElems = new Array();
			
			/* let's keep playback state */
			for (var i=0; i<elems.length; i++) {
				if (elems[i].style.begun && elems[i].style.playing) runningElems.push(elems[i]);
				
				if (elems[i].style.paused) pausedElems.push(elems[i]);
			}
			
			for (var i=0; i<elems.length; i++) {
				var elem = elems[i];
				if (Object.getOwnPropertyDescriptor(elem.style, 'timingDelay')) {
					elem.style.stop;
					parseItem(elem, elem.parentNode);
				}
			}
			
			/* restore playback state */
			if (document.body.style.timingPlayState != 'paused') document.body.style.play;
			for (var i=runningElems.length-1; i>=0; i--) {
				var style = window.tss(runningElems[i]);
				if (!style || style.timingPlayState != 'paused') runningElems[i].style.play;
			}
			for (var i=pausedElems.length-1; i>=0; i--) {
				pausedElems[i].style.pause;
			}
		}
	});
})()
