<!-- PayPal JS SDK -->
<script src="https://www.paypal.com/sdk/js?client-id=AV0x2V35Ar1OlHv_aRklbM-euMngtVFov_GzRUR_GvG1dIfotUBpxsBecyFEYoyUSJ9AO8pXPx6kcXSG&currency=USD"></script>
<script>
  // Render PayPal button for demo (replace with real logic as needed)
  document.addEventListener('DOMContentLoaded', function() {
    if (window.paypal && document.getElementById('paypal-button-container')) {
      paypal.Buttons({
        createOrder: function(data, actions) {
          return actions.order.create({
            purchase_units: [{ amount: { value: '29.00' } }]
          });
        },
        onApprove: function(data, actions) {
          return actions.order.capture().then(function(details) {
            alert('Payment completed by ' + details.payer.name.given_name);
            // TODO: Send transaction to backend for DB record
          });
        }
      }).render('#paypal-button-container');
    }
  });
</script>
