// Get references to your buttons and messages
const installAppButton = document.getElementById('installApp');
const enableNotificationsButton = document.getElementById('enableNotifications');
const sendTestNotificationButton = document.getElementById('sendTestNotification');
const offlineMessage = document.getElementById('offlineMessage');

let deferredPrompt; // This variable will store the browser's install event

// --- Service Worker Registration ---
// This registers your service worker (essential for PWA installability)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => {
                console.log('Service Worker registered! Scope:', reg.scope);
                // Check if already subscribed for push notifications on load
                checkSubscription();
            })
            .catch(err => {
                console.error('Service Worker registration failed:', err);
            });
    });

    // Listen for online/offline status changes to show/hide the message
    window.addEventListener('online', () => {
        offlineMessage.classList.add('hidden');
        console.log('App is online!');
    });

    window.addEventListener('offline', () => {
        offlineMessage.classList.remove('hidden');
        console.log('App is offline!');
    });

    // Initial check for offline status when app loads
    if (!navigator.onLine) {
        offlineMessage.classList.remove('hidden');
    }
} else {
    console.warn('Service Workers are not supported in this browser.');
    offlineMessage.textContent = 'Offline features are not supported in this browser.';
}


// --- "Add to Home Screen" (Install App) functionality ---
// This event fires when the browser determines the PWA is installable.
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile (optional, but good UX)
    e.preventDefault();
    // Stash the event so it can be triggered later by your custom button.
    deferredPrompt = e;
    // Show your custom "Install App" button by changing its display style.
    installAppButton.style.display = 'block';
    console.log('beforeinstallprompt event fired! Install button visible.');

    // Add a click listener to your custom button to trigger the browser's prompt.
    installAppButton.addEventListener('click', () => {
        // Hide your custom button once the prompt is shown (it won't fire again immediately)
        installAppButton.style.display = 'none';
        // Show the browser's official "Add to Home Screen" prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt (accept or dismiss)
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            } else {
                console.log('User dismissed the A2HS prompt');
            }
            deferredPrompt = null; // Clear the deferred prompt, it's a one-time use event
        });
    });
});

// --- Push Notification Logic ---
// VAPID public key (replace with your actual public key generated on the server)
// *** IMPORTANT: Replace 'YOUR_VAPID_PUBLIC_KEY_HERE' with your actual VAPID Public Key! ***
const applicationServerKey = 'YOUR_VAPID_PUBLIC_KEY_HERE';

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function checkSubscription() {
    // Check if Service Worker and Push API are supported by the browser
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported in this browser.');
        enableNotificationsButton.disabled = true; // Disable button if not supported
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            console.log('User is already subscribed for push notifications:', subscription);
            enableNotificationsButton.textContent = 'Notifications Enabled';
            enableNotificationsButton.disabled = true;
            sendTestNotificationButton.style.display = 'block'; // Show test button if subscribed
        } else {
            console.log('User is not subscribed for push notifications.');
            enableNotificationsButton.disabled = false; // Enable button if not subscribed
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
        enableNotificationsButton.disabled = true; // Disable on error
    }
}

enableNotificationsButton.addEventListener('click', async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Push notifications are not supported by your browser.');
        return;
    }

    // Request Notification Permission from the user
    const permissionResult = await Notification.requestPermission();
    if (permissionResult === 'granted') {
        console.log('Notification permission granted.');
        enableNotificationsButton.textContent = 'Subscribing...';
        enableNotificationsButton.disabled = true;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscribeOptions = {
                userVisibleOnly: true,
                applicationServerKey: urlB64ToUint8Array(applicationServerKey),
            };
            // Attempt to subscribe the user to push notifications
            const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);

            console.log('Push Subscription:', JSON.stringify(pushSubscription));
            // In a real application, you would send this `pushSubscription` object
            // to your backend server to store it. This server would then use it
            // to send actual push notifications to this user.
            alert('You are now subscribed to push notifications!');
            enableNotificationsButton.textContent = 'Notifications Enabled';
            sendTestNotificationButton.style.display = 'block'; // Show test button

        } catch (error) {
            console.error('Failed to subscribe the user: ', error);
            alert('Failed to subscribe to push notifications. Check console for details.');
            enableNotificationsButton.textContent = 'Enable Notifications';
            enableNotificationsButton.disabled = false; // Re-enable button on failure
        }
    } else if (permissionResult === 'denied') {
        console.warn('Notification permission denied.');
        alert('You have denied push notification permission.');
        enableNotificationsButton.disabled = true; // Disable if permission denied
    } else { // 'default' (user closed prompt without action)
        console.warn('Notification permission dismissed.');
    }
});

// For a simple client-side test notification (not a real push from server)
sendTestNotificationButton.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Test PWA Notification', {
            body: 'This is a test notification from your PWA!',
            icon: 'images/my-app-icon-192.png', // Ensure this path matches your icon file
            tag: 'test-notification' // A tag to group notifications
        });
        console.log('Client-side test notification sent.');
    } else {
        alert('Notification permission not granted or not supported.');
    }
});

// Initial check when app loads to update button state
checkSubscription();