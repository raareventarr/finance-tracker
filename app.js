// Bottom tabs: show the matching screen, hide the others.
const tabs = document.querySelectorAll('nav [data-tab]');

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const screen of document.querySelectorAll('main > section')) {
      screen.hidden = screen.id !== tab.dataset.tab;
    }
    for (const t of tabs) {
      if (t === tab) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    }
  });
}

// The + button gets its form in Step 2.
