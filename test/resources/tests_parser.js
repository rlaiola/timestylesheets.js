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
 * @overview Time Style Sheet (TSS) testing set.
 * @license MPL v1.1
 * @version 0.1
 */
 
/* test specificity calculator */
test('testing specificity calculator', function() {
	ok(window.tss('*').specificity == '0', 'Passed!');
	
	ok(window.tss('a').specificity == '1', 'Passed!');
	
	ok(window.tss('p a').specificity == '2', 'Passed!');
	
	ok(window.tss('.whatever').specificity == '10', 'Passed!');

	ok(window.tss('p a.whatever').specificity == '12', 'Passed!');
	
	ok(window.tss('.whatever .whatever').specificity == '20', 'Passed!');

	ok(window.tss('p.whatever a.whatever').specificity == '22', 'Passed!');

	ok(window.tss('#p > .whatever').specificity == '110', 'Passed!');

	ok(window.tss('li').specificity == '1', 'Passed!');

	ok(window.tss('li:first-line').specificity == '2', 'Passed!');

	ok(window.tss('ul li').specificity == '2', 'Passed!');

	ok(window.tss('ul ol+li').specificity == '3', 'Passed!');

	ok(window.tss('h1 + *[rel=up]').specificity == '11', 'Passed!');

	ok(window.tss('ul ol li.red').specificity == '13', 'Passed!');

	ok(window.tss('li.red.level').specificity == '21', 'Passed!');

	ok(window.tss('p').specificity == '1', 'Passed!');

	ok(window.tss('div p').specificity == '2', 'Passed!');

	ok(window.tss('.sith').specificity == '10', 'Passed!');

	ok(window.tss('div p.sith').specificity == '12', 'Passed!');

	ok(window.tss('#sith').specificity == '100', 'Passed!');

	ok(window.tss('body #darkside .sith p').specificity == '112', 'Passed!');

	ok(window.tss('ul#nav li.active a').specificity == '113', 'Passed!');

	ok(window.tss('body.ie7 .col_3 h2 ~ h2').specificity == '23', 'Passed!');

	ok(window.tss('#footer *:not(nav) li').specificity == '102', 'Passed!');

	ok(window.tss('ul > li ul li ol li:first-letter').specificity == '7', 'Passed!');
	
	ok(window.tss('div:idle').specificity == '2', 'Passed!');
	
	ok(window.tss('#v1:running').specificity == '101', 'Passed!');
	
	ok(window.tss('*:active').specificity == '1', 'Passed!');
	
	ok(window.tss('*:not-active').specificity == '1', 'Passed!');
	
	ok(window.tss('*:done').specificity == '1', 'Passed!');
});

/* test cascading and inheritance */
document.addEventListener('ontssparserready', function(e) {
	/* console.info('Event is: ', e); */
	
	test('testing cascade and inheritance', function() {
		ok(window.tss('*') != null, 'Passed!');
		
		ok(window.tss('div').timingDelay == '1', 'Passed!');
		
		ok(window.tss('div').timingContainer == 'par', 'Passed!');
		
		ok(window.tss('p').timingDelay == '10', 'Passed!');
		
		ok(window.tss('span').timingContainer == 'seq', 'Passed!');
		
		ok(window.tss('span').timingDelay == '2', 'Passed!');
		
		ok(window.tss('.media').timingDuration == '7.0', 'Passed!');
		
		ok(window.tss('#my_picture').timingDuration == '11', 'Passed!');
		
		ok(window.tss('#my_picture').timingDelay == '0', 'Passed!');
		
		ok(window.tss('#my_picture').onbegin == undefined, 'Passed!');
		
		ok(window.tss('#my_picture').onend == undefined, 'Passed!');
		
		ok(window.tss('#my_picture').house == undefined, 'Passed!');
		
		ok(window.tss(document.getElementById('my_picture')).timingDuration == '11.0', 'Passed!');
		
		ok(window.tss(document.getElementById('my_picture')).timingDelay == '20.0', 'Passed!');
		
		ok(window.tss(document.getElementById('my_picture')).timingIterationCount == '3', 'Passed!');
		
		ok(window.tss(document.getElementById('my_picture')).bike == undefined, 'Passed!');
		
 		ok(window.tss('video').timingDelay == '0', 'Passed!');
 		
 		ok(window.tss('video').timingDelay == '0.0', 'Passed!');
 		
 		ok(window.tss('video').car == undefined, 'Passed!');
 		
 		ok(window.tss('video').clipbegin == undefined, 'Passed!');
 		
 		ok(window.tss('video').clipend != '0', 'Passed!');
 		
 		ok(window.tss('video').timingIterationCount == '1', 'Passed!');
 		
 		ok(window.tss('video').volume == undefined, 'Passed!');
 		
 		ok(eval(window.tss('video').onbegin) == null, 'Passed!');
 		
 		ok(eval(window.tss('video').onend) == null, 'Passed!');
 		
 		ok(eval(window.tss('video').effectin) == null, 'Passed!');
 		
 		ok(eval(window.tss('video').effectout) == null, 'Passed!');
 		
 		ok(window.tss('div').timingPlayState == 'paused', 'Passed!');
 		
 		ok(window.tss('video').timingPlayState == 'running', 'Passed!');
 		
 		ok(window.tss('video').timingPlayState != 'paused', 'Passed!');
	});
});
