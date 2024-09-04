let kanbanContext = await browser.contextualIdentities.create({
    "name": "icanban",
    "color": "blue",
    "icon": "tree"
});

let kanbanMenuItem = await browser.menus.create({
    "title": "Display kanban board",
    "contexts": ["tools_menu"],
    "icons": {
        "16": "images/icanban_16x16.png",
        "32": "images/icanban_32x32.png"
    }
});


let createKanbanBoard = async () => {
    let icanbanTab = await browser.tabs.query({ 
        "cookieStoreId": kanbanContext.cookieStoreId,
    });

    if (icanbanTab.length===0) {
        browser.tabs.create({
            "cookieStoreId": kanbanContext.cookieStoreId,
            "url": "./ui/board.html"
        });
    } else {
        browser.tabs.update(icanbanTab[0].id, { active: true });
    }
}

browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === kanbanMenuItem) {
        createKanbanBoard();
    }
});

browser.browserAction.onClicked.addListener(async (...args) => {
    createKanbanBoard();
 });
