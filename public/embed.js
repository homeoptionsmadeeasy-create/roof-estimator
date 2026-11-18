// Drop this on any page of your website:
//   <div id="roof-quote"></div>
//   <script src="https://YOUR-ESTIMATOR-DOMAIN/embed.js" async></script>
(function () {
  var script = document.currentScript;
  var origin = new URL(script.src).origin;
  var target = document.getElementById('roof-quote') || script.parentNode;
  var iframe = document.createElement('iframe');
  // Pass UTM / ad click params from the host page through to the lead
  var qs = new URLSearchParams(location.search);
  if (script.hasAttribute('data-compact')) qs.set('compact', '1');
  iframe.src = origin + '/' + (qs.toString() ? '?' + qs.toString() : '');
  iframe.title = 'Instant roof estimate';
  iframe.style.cssText = 'width:100%;border:0;min-height:520px;display:block;overflow:hidden';
  iframe.setAttribute('scrolling', 'no');
  target.appendChild(iframe);
  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data) return;
    if (e.data.type === 'roof-quote:height') iframe.style.height = e.data.height + 'px';
    if (e.data.type === 'roof-quote:lead') {
      // Fire conversion events if Google Ads / GA4 / Meta Pixel are on the page
      if (window.gtag) window.gtag('event', 'generate_lead', { event_category: 'roof_estimate' });
      if (window.fbq) window.fbq('track', 'Lead');
      if (window.dataLayer) window.dataLayer.push({ event: 'roof_estimate_lead', estimate: e.data.quote });
    }
  });
})();
