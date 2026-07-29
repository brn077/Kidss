// Cart drawer
  (function(){
    var drawer = document.getElementById('cartDrawer');
    var overlay = document.getElementById('drawerOverlay');
    function open(){
      drawer.classList.add('open'); overlay.classList.add('open');
      if(typeof fbq === 'function'){ fbq('track', 'AddToCart'); }
    }
    function close(){ drawer.classList.remove('open'); overlay.classList.remove('open'); }
    document.getElementById('cartOpen').addEventListener('click', open);
    document.getElementById('drawerClose').addEventListener('click', close);
    overlay.addEventListener('click', close);
  })();

  // Fade-in on scroll
  (function(){
    var els = document.querySelectorAll('.fade-up');
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in-view'); }
      });
    }, {threshold:0.15});
    els.forEach(function(el){ obs.observe(el); });
  })();

  // Meta Pixel: InitiateCheckout ao clicar em qualquer botão de compra
  (function(){
    document.querySelectorAll('a.cta').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(typeof fbq === 'function'){ fbq('track', 'InitiateCheckout'); }
      });
    });
  })();



