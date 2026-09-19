const search = document.querySelector('#guide-search');
const cards = [...document.querySelectorAll('.guide-card')];
const empty = document.querySelector('#empty-search');

search?.addEventListener('input', () => {
  const query = search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  let visible = 0;

  cards.forEach(card => {
    const text = card.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    card.hidden = !text.includes(query);
    if (!card.hidden) visible++;
  });

  empty.hidden = visible !== 0;
});
