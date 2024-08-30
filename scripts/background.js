let kanbanContext = await browser.contextualIdentities.create({
    "name": "icanban",
    "color": "blue",
    "icon": "tree"
});

console.log("Kanban context", kanbanContext);


browser.browserAction.onClicked.addListener(async (...args) => {
    console.log("action clicked", ...args);
    let icanbanTab = await browser.tabs.query({ "cookieStoreId": "icanban"});

    if (icanbanTab.length===0) {
        browser.tabs.create({
            "cookieStoreId": kanbanContext.cookieStoreId,
            "url": "ui/board.html"
        });
    }
});
