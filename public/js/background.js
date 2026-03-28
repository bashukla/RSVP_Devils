// BACKGROUND MANAGER - included on all pages except logon
(function() {
    const savedBg = localStorage.getItem('homeBg');
    if (savedBg) applyBackground(savedBg);

    function applyBackground(bg) {
        if (!bg || bg === 'none') {
            document.body.style.backgroundImage = 'none';
            document.body.style.backgroundColor = '#f5f6fa';
        } else if (bg.startsWith('data:image')) {
            // Custom uploaded image (base64)
            document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${bg}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundPosition = 'center';
        } else if (bg.startsWith('url')) {
            document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), ${bg}`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundPosition = 'center';
        } else {
            document.body.style.backgroundImage = bg;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundAttachment = 'fixed';
        }
    }

    // Expose globally so userSettings can call it on picker change
    window.applyBackground = applyBackground;
})();
