const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const globalShortcut = electron.globalShortcut;
const Menu = electron.Menu;
const utils = require('./js/utils.js');

const platform = process.platform.startsWith('win') ? 'win' : process.platform;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
function openMainWindow() {
  // 根据透明度设置决定是否要创建transparent窗口
  // 不论在windows还是在mac下，正常窗口都会比transparent窗口多一个好看的阴影
  // 所以我们不希望为了方便始终使用transparent
  var opacity = utils.config.get('opacity'),
      windowParams = {width: 375, height: 500, frame: false};
  if( opacity < 1 ) {
    windowParams.transparent = true;
  }
  mainWindow = new electron.BrowserWindow(windowParams);
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  mainWindow.setAlwaysOnTop(true, 'torn-off-menu');
  mainWindow.on('closed', () => {
    mainWindow = null;
    if( selectPartWindow ) {
      selectPartWindow.close();
      selectPartWindow = null;
    }
  });
  // 带起来自己的子窗口
  initSelectPartWindow();
  initConfigWindow();
  // mainWindow.webContents.openDevTools();
}

// 初始化选分p窗口
let selectPartWindow = null;
function initSelectPartWindow() {
  selectPartWindow = new electron.BrowserWindow({
    width: 200, height: 300, 
    parent: mainWindow, frame: false, show: false
  });
  selectPartWindow.hide();
  selectPartWindow.loadURL('file://' + __dirname + '/selectP.html');
  selectPartWindow.on('closed', () => {
    selectPartWindow = null;
  });
  // selectPartWindow.openDevTools();
}

function openSelectPartWindow() {
  if( !mainWindow || !selectPartWindow ) {
    return;
  }
  var p = mainWindow.getPosition(), s = mainWindow.getSize(),
      pos = [p[0] + s[0] + 10, p[1]];
  selectPartWindow.setPosition(pos[0], pos[1]);
  selectPartWindow.show();
}

function openSelectPartWindowOnMessage() {
  // 切换、可开可关
  ipc.on('toggle-select-part-window', () => {
    if( selectPartWindow && selectPartWindow.isVisible() ) {
      selectPartWindow.hide();
    } else {
      openSelectPartWindow();
    }
  });
  // 仅开启
  ipc.on('show-select-part-window', openSelectPartWindow);
}

// 初始化设置窗口
let configWindow = null;
function initConfigWindow() {
  configWindow = new electron.BrowserWindow({
    width: 200, height: 200,
    parent: mainWindow, frame: false, show: false
  });
  configWindow.hide();
  configWindow.loadURL('file://' + __dirname + '/config.html');
  configWindow.on('closed', () => {
    configWindow = null;
  });
  // configWindow.openDevTools();
}

function openConfigWindow() {
  if( !mainWindow || !configWindow ) {
    return;
  }
  var p = mainWindow.getPosition(), s = configWindow.getSize(),
      pos = [p[0] - s[0] - 10, p[1]];
  configWindow.setPosition(pos[0], pos[1]);
  configWindow.show();
}

function openConfigWindowOnMessage() {
  // 切换、可开可关
  ipc.on('toggle-config-window', () => {
    if( configWindow && configWindow.isVisible() ) {
      configWindow.hide();
    } else {
      openConfigWindow();
    }
  });
  // 仅开启
  ipc.on('show-config-window', openConfigWindow);
}

function initExchangeMessageForRenderers() {
  // 转发分p数据，真的只能用这么蠢的方法实现么。。。
  ipc.on('update-part', (ev, args) => {
    if( !args && selectPartWindow && selectPartWindow.isVisible() ) {
      selectPartWindow.hide();
    }
    selectPartWindow && selectPartWindow.webContents.send('update-part', args);
  });
  // 转发番剧分p消息，这俩的格式是不一样的，分局的分p里头带了playurl
  ipc.on('update-bangumi-part', (ev, args) => {
    selectPartWindow && selectPartWindow.webContents.send('update-bangumi-part', args);
  });
  // 转发选p消息
  ipc.on('select-part', (ev, args) => {
    mainWindow && mainWindow.webContents.send('select-part', args);
  });
  // 番剧选P
  ipc.on('select-bangumi-part', (ev, args) => {
    mainWindow && mainWindow.webContents.send('select-bangumi-part', args);
  });
}

  
// mainWindow在default/mini尺寸间切换时同时移动selectPartWindow
function reposSelectPartWindowOnMainWindowResize() {
  ipc.on('main-window-resized', (ev, pos, size) => {
    selectPartWindow && selectPartWindow.setPosition((pos[0] + size[0] + 10), pos[1], true);
  });
}

function init() {
  openMainWindow();
  bindGloablShortcut();
  initMenu();
  initExchangeMessageForRenderers();
  openSelectPartWindowOnMessage();
  openConfigWindowOnMessage();
  reposSelectPartWindowOnMainWindowResize();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', init);

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if( mainWindow === null ) {
    openMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on('window-all-closed', () => {
  // 试了下，似乎electron的默认行为是在所有窗口都关闭后就执行app.quit()
  // 所以我们希望所有窗口关闭后不退出程序就必须手动监听这个事件
});

// 菜单
function initMenu() {
  // 本来我们是不需要菜单的，但是因为mac上app必须有菜单，所以只在mac上做一下
  if( platform != 'darwin' ) return;
  var template = [{
      label: app.getName(),
      submenu: [
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }, {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    }, {
      label: 'Debug',
      submenu: [
        {
          label: 'Inspect Main Window',
          accelerator: 'CmdOrCtrl+1',
          click() { mainWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Select Part Window',
          accelerator: 'CmdOrCtrl+2',
          click() { selectPartWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Config Window',
          accelerator: 'CmdOrCtrl+3',
          click() { configWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Webview',
          accelerator: 'CmdOrCtrl+4',
          click() { mainWindow.webContents.send('openWebviewDevTools'); }
        }
      ]
    }, {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];
  var menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 老板键
function bindGloablShortcut() {
  let shortcut = platform == 'darwin' ? 'alt+w' : 'ctrl+e';
  let bindRes = globalShortcut.register(shortcut, () => {
    if( mainWindow ) {
      if( mainWindow.isVisible() ) {
        mainWindow.hide();
        selectPartWindow && selectPartWindow.isVisible() && selectPartWindow.hide();
      } else {
        mainWindow.showInactive();
      }
    } else {
      openMainWindow();
    }
  });
  if( !bindRes ) {
    console.log('Fail to bind globalShortcut');
  }
}