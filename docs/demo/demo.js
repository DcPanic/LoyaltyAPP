/**
 * Static preview of LoyaltyApp. All state lives in this file: there is no
 * server, no database and no real wallet pass here. The screens and the rules
 * they show (one stamp per request, staff limited to stamping, one card per
 * café updated in place) mirror the real application.
 */
(function () {
  'use strict';

  var BUSINESS = {
    name: 'Coffee House',
    primary: '#6F4E37',
    address: 'Makariou Avenue 12, Nicosia',
    phone: '+357 22 123456',
    reward: 'Free coffee',
  };

  var state = {
    view: 'customer',
    joined: false,
    customer: { firstName: 'Maria', lastName: 'K.', phone: '+357 99 112233' },
    memberCode: 'A7K2M9QX4T1B',
    stamps: 0,
    required: 10,
    totalStamps: 0,
    rewardsRedeemed: 0,
    rewardReady: false,
    staffSelected: null,
    others: [
      { id: 'g', name: 'Giorgos Demetriou', phone: '+357 99 445566', stamps: 7 },
      { id: 'e', name: 'Elena Papadopoulou', phone: '+357 99 778899', stamps: 3 },
    ],
    activity: [
      { name: 'Giorgos Demetriou', amount: 1, channel: 'NFC', ago: '12 min' },
      { name: 'Christina Kyriakou', amount: 2, channel: 'staff app', ago: '28 min' },
      { name: 'Nikos Ioannou', amount: 1, channel: 'phone order', ago: '41 min' },
    ],
    stampsToday: 18,
  };

  /* --------------------------------------------------------- helpers ---- */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(id) {
    return document.getElementById(id);
  }

  var toastTimer = null;
  function toast(message) {
    var node = el('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove('show');
    }, 2400);
  }

  function stampGrid(stamps, required) {
    var html = '<div class="stamp-grid">';
    for (var i = 0; i < required; i += 1) {
      html += '<span class="stamp-dot' + (i < stamps ? ' filled' : '') + '">' + (i < stamps ? '☕' : '') + '</span>';
    }
    return html + '</div>';
  }

  function customerName() {
    return (state.customer.firstName + ' ' + (state.customer.lastName || '')).trim();
  }

  /* ----------------------------------------------------- the actions ---- */

  function addStamps(amount, channel) {
    if (!state.joined) {
      toast('The customer needs a card first');
      return;
    }
    state.stamps += amount;
    state.totalStamps += amount;
    state.stampsToday += amount;
    if (state.stamps >= state.required) state.rewardReady = true;
    state.activity.unshift({
      name: customerName(),
      amount: amount,
      channel: channel,
      ago: 'just now',
    });
    state.activity = state.activity.slice(0, 8);
    render();
    toast(
      state.rewardReady
        ? BUSINESS.reward + ' unlocked for ' + state.customer.firstName + ' 🎁'
        : '+' + amount + ' stamp' + (amount > 1 ? 's' : '') + ' · ' + state.stamps + '/' + state.required,
    );
  }

  function redeem() {
    if (!state.rewardReady) return;
    state.stamps -= state.required;
    state.rewardsRedeemed += 1;
    state.rewardReady = state.stamps >= state.required;
    state.activity.unshift({ name: customerName(), amount: 0, channel: 'reward', ago: 'just now' });
    render();
    toast(BUSINESS.reward + ' redeemed — the card resets, the pass stays');
  }

  function join(firstName) {
    state.customer.firstName = firstName || 'Maria';
    state.joined = true;
    render();
    toast('Card created — it is ready for the wallet');
  }

  /* ------------------------------------------------- customer screen ---- */

  function renderCustomer() {
    var screen = el('customer-screen');
    var remaining = Math.max(0, state.required - state.stamps);

    if (!state.joined) {
      screen.innerHTML =
        '<div class="public-inner">' +
        '<div class="public-cover" style="background:#F5E9DA"></div>' +
        '<div class="public-logo" style="background:' + BUSINESS.primary + '">C</div>' +
        '<h1 class="center">' + esc(BUSINESS.name) + '</h1>' +
        '<p class="center hint">Join our loyalty program</p>' +
        '<div class="card center"><h2>Collect 10 stamps, get a free coffee</h2>' +
        '<p class="hint" style="margin-bottom:0">Your card lives in Apple Wallet or Google Wallet — no app to install.</p></div>' +
        '<div class="card"><form id="join-form">' +
        '<div class="field"><label for="d-first">First name</label><input id="d-first" type="text" value="Maria" /></div>' +
        '<div class="field"><label for="d-phone">Mobile phone</label><input id="d-phone" type="tel" value="+357 99 112233" /></div>' +
        '<div class="field"><label class="checkbox"><input type="checkbox" checked /><span>Send me offers from ' +
        esc(BUSINESS.name) + '</span></label></div>' +
        '<button class="btn block lg" type="submit">Get my loyalty card</button>' +
        '</form></div></div>';

      el('join-form').addEventListener('submit', function (event) {
        event.preventDefault();
        join(el('d-first').value.trim());
      });
      return;
    }

    screen.innerHTML =
      '<div class="public-inner">' +
      '<div class="public-cover" style="background:#F5E9DA"></div>' +
      '<div class="public-logo" style="background:' + BUSINESS.primary + '">C</div>' +
      '<h1 class="center">' + esc(BUSINESS.name) + '</h1>' +
      '<p class="center hint">Hi ' + esc(state.customer.firstName) + ' — here is your card</p>' +
      '<div class="card">' +
      (state.rewardReady
        ? '<div class="alert success" style="text-align:center">🎁 ' + esc(BUSINESS.reward) + ' is ready — show this to the barista.</div>'
        : '<p class="center"><strong>' + remaining + '</strong> more ' + (remaining === 1 ? 'stamp' : 'stamps') + ' until ' + esc(BUSINESS.reward) + '</p>') +
      '<div style="display:flex;justify-content:center;margin:0.75rem 0">' + stampGrid(Math.min(state.stamps, state.required), state.required) + '</div>' +
      '<div class="progress"><span style="width:' + Math.min(100, (state.stamps / state.required) * 100) + '%"></span></div>' +
      '<p class="center hint" style="margin:0.6rem 0 0">' + state.stamps + ' / ' + state.required + ' stamps · ' +
      state.totalStamps + ' collected all-time · ' + state.rewardsRedeemed + ' rewards enjoyed</p></div>' +
      '<div class="card center"><h3>Show this to the barista</h3>' +
      '<div class="qr-fake" role="img" aria-label="Member QR code"></div>' +
      '<p class="member-code" style="margin-top:0.75rem">' + esc(state.memberCode) + '</p></div>' +
      '<div class="card"><h3 class="center">Keep it in your wallet</h3>' +
      '<div class="wallet-buttons">' +
      '<a class="wallet-btn" href="#" onclick="return false"> Add to Apple Wallet</a>' +
      '<a class="wallet-btn google" href="#" onclick="return false">Add to Google Wallet</a>' +
      '</div></div>' +
      '<div class="card"><h3>Keep your card on your phone</h3>' +
      '<p class="hint" style="margin-bottom:0">Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> — the card gets its own icon.</p></div>' +
      '<div class="card"><p class="hint" style="margin:0">' + esc(BUSINESS.name) + ' · ' + esc(BUSINESS.address) + ' · ' + esc(BUSINESS.phone) + '</p></div>' +
      '</div>';
  }

  function renderCustomerSteps() {
    var steps = [
      {
        title: 'Scan the QR on the counter',
        body: 'A branded page opens in the browser. No app store, no download.',
        done: state.joined,
        active: !state.joined,
      },
      {
        title: 'Add the card to the wallet',
        body: 'One Apple Wallet or Google Wallet pass per café, issued by your own backend.',
        done: state.joined,
        active: state.joined && state.totalStamps === 0,
      },
      {
        title: 'Tap the NFC stamp on every visit',
        body: 'The phone opens a page that adds the stamp and closes the loop in about a second.',
        done: state.totalStamps > 0,
        active: state.joined && state.totalStamps > 0,
      },
      {
        title: 'Collect the reward',
        body: 'At ' + state.required + ' stamps the card shows the reward until a barista redeems it.',
        done: state.rewardsRedeemed > 0,
        active: state.rewardReady,
      },
    ];

    el('customer-steps').innerHTML = steps
      .map(function (step, index) {
        return (
          '<div class="step' + (step.active ? ' active' : '') + '">' +
          '<span class="n">' + (step.done ? '✓' : index + 1) + '</span>' +
          '<div><strong>' + esc(step.title) + '</strong><p>' + esc(step.body) + '</p></div></div>'
        );
      })
      .join('');

    el('nfc-hint').textContent = state.joined
      ? 'Tap to add a stamp — ' + state.stamps + '/' + state.required
      : 'Get the card first, then tap';

    var remaining = Math.max(0, state.required - state.stamps);
    el('wallet-preview').innerHTML =
      '<div class="card" style="background:' + BUSINESS.primary + ';color:#fff;border:none">' +
      '<div class="spread"><strong>' + esc(BUSINESS.name) + '</strong><span>' + state.stamps + '/' + state.required + '</span></div>' +
      '<div style="font-size:1.4rem;letter-spacing:0.15em;margin:0.5rem 0">' +
      '●'.repeat(Math.min(state.stamps, state.required)) + '○'.repeat(remaining) + '</div>' +
      '<small>' + (state.rewardReady ? '🎁 ' + esc(BUSINESS.reward) + ' available' : remaining + ' more until ' + esc(BUSINESS.reward)) + '</small>' +
      '</div>';
  }

  /* ---------------------------------------------------- staff screen ---- */

  function renderStaff() {
    var screen = el('staff-screen');
    var selected = state.staffSelected;

    var header =
      '<div class="spread" style="padding:0.25rem 0 0.75rem">' +
      '<div><small class="hint">Coffee House</small><div style="font-weight:600">Elena Georgiou</div></div>' +
      '<span class="badge">staff</span></div>';

    if (!selected) {
      var results = [{ id: 'm', name: customerName(), phone: state.customer.phone, stamps: state.stamps }]
        .concat(state.others)
        .map(function (person) {
          return (
            '<button class="search-result" data-person="' + person.id + '">' +
            '<span><strong>' + esc(person.name) + '</strong><br><small class="hint">' + esc(person.phone) + '</small></span>' +
            '<span class="badge">' + person.stamps + '/' + state.required + '</span></button>'
          );
        })
        .join('');

      screen.innerHTML =
        header +
        '<div class="card"><h2>Stamp a customer</h2>' +
        '<button class="btn block lg" data-scan="1">Scan customer QR</button>' +
        '<div class="field" style="margin-top:0.9rem"><label for="d-search">Or find them</label>' +
        '<input id="d-search" type="search" placeholder="Phone, email, name or member code" /></div>' +
        '<p class="hint">Works for phone and delivery orders — the customer does not need to be here.</p>' +
        '<div class="grid" style="margin-top:0.5rem">' + results + '</div></div>' +
        recentActivityCard();

      Array.prototype.forEach.call(screen.querySelectorAll('[data-person]'), function (button) {
        button.addEventListener('click', function () {
          state.staffSelected = button.getAttribute('data-person');
          render();
        });
      });
      screen.querySelector('[data-scan]').addEventListener('click', function () {
        state.staffSelected = 'm';
        render();
        toast('QR scanned — ' + customerName());
      });
      return;
    }

    var person =
      selected === 'm'
        ? { name: customerName(), phone: state.customer.phone, stamps: state.stamps }
        : state.others.filter(function (p) { return p.id === selected; })[0];
    var isDemoCustomer = selected === 'm';

    screen.innerHTML =
      header +
      '<div class="card">' +
      '<div class="spread"><div><h2 style="margin-bottom:0">' + esc(person.name) + '</h2>' +
      '<small class="hint">' + esc(person.phone) + '</small></div>' +
      '<button class="btn ghost" data-back="1">Change</button></div>' +
      '<div style="margin:0.9rem 0">' + stampGrid(Math.min(person.stamps, state.required), state.required) + '</div>' +
      '<p class="hint">' + person.stamps + ' / ' + state.required + ' stamps</p>' +
      (isDemoCustomer && state.rewardReady
        ? '<div class="alert success">🎁 ' + esc(BUSINESS.reward) + ' is ready<button class="btn block" style="margin-top:0.6rem" data-redeem="1">Redeem reward</button></div>'
        : '') +
      '<label>Add stamps</label><div class="stamp-amounts">' +
      [1, 2, 3, 5, 10]
        .map(function (n) { return '<button data-add="' + n + '">+' + n + '</button>'; })
        .join('') +
      '</div>' +
      '<div class="row" style="margin-top:0.9rem">' +
      '<button class="btn secondary" data-add="1" data-channel="phone order">+1 phone order</button>' +
      '<button class="btn secondary" data-add="1" data-channel="delivery">+1 delivery</button>' +
      '</div></div>' +
      recentActivityCard();

    screen.querySelector('[data-back]').addEventListener('click', function () {
      state.staffSelected = null;
      render();
    });
    var redeemButton = screen.querySelector('[data-redeem]');
    if (redeemButton) redeemButton.addEventListener('click', redeem);

    Array.prototype.forEach.call(screen.querySelectorAll('[data-add]'), function (button) {
      button.addEventListener('click', function () {
        var amount = Number(button.getAttribute('data-add'));
        var channel = button.getAttribute('data-channel') || 'staff app';
        if (!isDemoCustomer) {
          toast('This preview only tracks ' + state.customer.firstName + "'s card");
          return;
        }
        addStamps(amount, channel);
      });
    });
  }

  function recentActivityCard() {
    return (
      '<div class="card"><h2>Recent activity</h2>' +
      state.activity
        .map(function (item) {
          return (
            '<div class="spread" style="padding:0.4rem 0;border-bottom:1px solid var(--line)">' +
            '<div><strong>' + esc(item.name) + '</strong><br><small class="hint">' + esc(item.ago) + ' · ' + esc(item.channel) + '</small></div>' +
            '<span class="badge ' + (item.channel === 'reward' ? 'vip' : 'ok') + '">' +
            (item.channel === 'reward' ? '🎁 reward' : '+' + item.amount) + '</span></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  /* ---------------------------------------------------- owner screen ---- */

  var BASE_DAYS = [6, 4, 5, 9, 5, 7, 1, 1, 4, 8, 5, 3, 4, 4, 7, 3, 4, 9, 5, 7, 12, 1, 10, 8, 3, 3, 4, 5, 6, 18];

  function chart() {
    var days = BASE_DAYS.slice();
    days[days.length - 1] = state.stampsToday;
    var max = Math.max.apply(null, days);
    var width = 720;
    var height = 190;
    var slot = (width - 40) / days.length;

    var bars = days
      .map(function (value, index) {
        var barHeight = (value / max) * (height - 40);
        return (
          '<rect x="' + (36 + index * slot) + '" y="' + (height - 24 - barHeight) + '" width="' + (slot - 3) +
          '" height="' + Math.max(barHeight, 2) + '" rx="4" fill="#6F4E37"' +
          (index === days.length - 1 ? ' opacity="1"' : ' opacity="0.85"') + '><title>' + value + ' stamps</title></rect>'
        );
      })
      .join('');

    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" class="chart" role="img" aria-label="Stamps per day for the last 30 days">' +
      '<line x1="36" x2="' + (width - 4) + '" y1="' + (height - 24) + '" y2="' + (height - 24) + '" stroke="#7A6A5D"/>' +
      '<text x="30" y="20" text-anchor="end" font-size="10" fill="#7A6A5D">' + max + '</text>' +
      '<text x="30" y="' + (height - 20) + '" text-anchor="end" font-size="10" fill="#7A6A5D">0</text>' +
      bars +
      '<text x="36" y="' + (height - 6) + '" font-size="10" fill="#7A6A5D">30 days ago</text>' +
      '<text x="' + (width - 4) + '" y="' + (height - 6) + '" font-size="10" fill="#7A6A5D" text-anchor="end">today</text>' +
      '</svg>'
    );
  }

  function segmentBar(label, explain, count, total, color) {
    var pct = total ? Math.round((count / total) * 100) : 0;
    return (
      '<li style="margin-bottom:0.7rem"><div class="spread" style="margin-bottom:0.25rem">' +
      '<span style="display:inline-flex;align-items:center;gap:0.45rem">' +
      '<i style="width:10px;height:10px;border-radius:3px;background:' + color + ';display:inline-block"></i>' +
      '<strong style="font-size:0.9rem">' + label + '</strong> <small class="hint">' + explain + '</small></span>' +
      '<span style="font-size:0.9rem"><strong>' + count + '</strong> <small class="hint">(' + pct + '%)</small></span></div>' +
      '<div style="height:10px;background:var(--cream);border-radius:999px;overflow:hidden">' +
      '<span style="display:block;width:' + pct + '%;height:100%;background:' + color + ';border-radius:999px"></span></div></li>'
    );
  }

  function renderOwner() {
    var customers = 41 + (state.joined ? 1 : 0);

    el('owner-screen').innerHTML =
      '<div class="topbar"><h1>Dashboard</h1><span class="badge"><span style="color:var(--success)">●</span> Live</span></div>' +
      '<div class="grid cols-4">' +
      '<div class="stat"><div class="label">Stamps today</div><div class="value">' + state.stampsToday + '</div><div class="hint">updates as you stamp</div></div>' +
      '<div class="stat"><div class="label">Customers</div><div class="value">' + customers + '</div><div class="hint">9 joined this month</div></div>' +
      '<div class="stat"><div class="label">Active members</div><div class="value">36</div><div class="hint">Active in the last 30 days</div></div>' +
      '<div class="stat"><div class="label">Rewards redeemed</div><div class="value">' + (6 + state.rewardsRedeemed) + '</div><div class="hint">' +
      (state.rewardReady ? '1 waiting to be collected' : '0 waiting to be collected') + '</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:1rem"><div class="card-header"><div><h2>Stamps per day</h2>' +
      '<small class="hint">Last 30 days</small></div></div>' + chart() + '</div>' +
      '<div class="grid cols-2" style="margin-top:1rem">' +
      '<div class="card"><div class="card-header"><h2>Customer segments</h2></div>' +
      '<ul style="list-style:none;margin:0;padding:0">' +
      segmentBar('New', 'Joined in the last 14 days', 5 + (state.joined ? 1 : 0), 42, '#2a78d6') +
      segmentBar('Active', 'Coming back regularly', 32, 42, '#1baf7a') +
      segmentBar('VIP', '20+ stamps in 60 days', 1, 42, '#eda100') +
      segmentBar('At risk', 'Nothing for 30 days', 4, 42, '#eb6834') +
      segmentBar('Lost', 'Nothing for 90 days', 0, 42, '#e87ba4') +
      '</ul></div>' +
      '<div class="card"><div class="card-header"><h2>Live activity</h2></div>' +
      '<table><tbody>' +
      state.activity
        .slice(0, 6)
        .map(function (item) {
          return (
            '<tr><td><strong>' + esc(item.name) + '</strong><br><small class="hint">' + esc(item.ago) + ' · ' + esc(item.channel) + '</small></td>' +
            '<td style="text-align:right"><span class="badge ' + (item.channel === 'reward' ? 'vip' : 'ok') + '">' +
            (item.channel === 'reward' ? '🎁 reward' : '+' + item.amount) + '</span></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>' +
      '<p class="hint" style="margin:0.75rem 0 0">A stamp taken on the barista\'s phone or at an NFC tag appears here within a second.</p>' +
      '</div></div>';
  }

  /* ---------------------------------------------------------- wiring ---- */

  function render() {
    renderCustomer();
    renderCustomerSteps();
    renderStaff();
    renderOwner();

    ['customer', 'staff', 'owner'].forEach(function (view) {
      el('view-' + view).hidden = state.view !== view;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (button) {
      button.setAttribute('aria-selected', String(button.getAttribute('data-view') === state.view));
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (button) {
    button.addEventListener('click', function () {
      state.view = button.getAttribute('data-view');
      render();
    });
  });

  el('nfc-button').addEventListener('click', function () {
    addStamps(1, 'NFC');
  });

  render();
})();
