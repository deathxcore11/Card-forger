// The Search page's answer card (a typed question answered from the app's own data). app.js fills it; the page markup shows it.
export const searchAnswer={html:'',state:null};
export const searchAnswerMarkup=()=>searchAnswer.html?`<div class="search-answer" data-search-answer>${searchAnswer.html}</div>`:'';
