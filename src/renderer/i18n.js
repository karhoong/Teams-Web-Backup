(() => {
  const en = {
    appName: "Teams Web Backup",
    initialStatus: "Sign in to Teams, open Chats, then start an export.",
    teams: "Teams",
    reloadTeams: "Reload Teams",
    resetSession: "Reset Session",
    folder: "Folder",
    chooseFolder: "Choose Folder",
    openExport: "Open Export",
    concurrentThreads: "Concurrent Download Threads",
    exportChat: "Export Chat",
    exportFiles: "Export Files",
    currentChat: "Current Chat",
    allChats: "All Chats",
    resume: "Resume",
    resumeTitle: "Resume from an existing export folder",
    stop: "Stop",
    devTools: "Dev Tools",
    app: "App",
    browser: "Browser",
    settings: "Settings",
    chats: "chats",
    messages: "messages",
    queued: "queued",
    files: "files",
    failed: "failed",
    queueItems: "Queue Items",
    hideQueue: "Hide Queue",
    filesWaiting: "Files waiting to download",
    queueBreakdown: "queued: {files} files, {images} images, {avatars} avatars, {pdf} pdf, {downloading} downloading, {manual} manual",
    exportParentFolder: "Export parent folder: {folder}",
    currentExportStarted: "Current chat export started: {folder}",
    allExportStarted: "All chats export started: {folder}",
    currentFilesStarted: "Current chat Shared files export started: {folder}",
    allFilesStarted: "All chats Shared files export started: {folder}",
    resumingExport: "Resuming export: {folder}",
    downloadQueue: "Download Queue",
    noQueuedItems: "No queued items.",
    refresh: "Refresh",
    close: "Close",
    nothingWaiting: "Nothing is waiting to download.",
    queueSummary: "{total} items, showing {showing}: {downloading} downloading, {queued} queued, {manual} manual{hidden}.",
    hiddenQueueItems: ", {count} more in checkpoint/files.jsonl",
    copyUrl: "Copy URL",
    copied: "Copied",
    open: "Open",
    statusQueued: "queued",
    statusDownloading: "downloading",
    statusDownloaded: "downloaded",
    statusFailed: "failed",
    statusManual: "manual",
    kindFile: "file",
    kindImage: "image",
    kindPdf: "PDF",
    kindAvatar: "avatar",
    kindLink: "link",
    diagnostics: "Diagnostics",
    loadingDiagnostics: "Loading diagnostics...",
    copy: "Copy",
    clearView: "Clear View",
    noDiagnostics: "No diagnostics yet.",
    running: "Running",
    notRunning: "Not running",
    yes: "yes",
    no: "no",
    phase: "Phase",
    stopRequested: "Stop requested",
    lastProgress: "Last progress",
    teamsUrl: "Teams URL",
    exportFolder: "Export folder",
    queue: "Queue",
    queueUnavailable: "queue unavailable",
    diagnosticsQueue: "{queued} queued, {downloading} downloading, {active} active, {browserPending} browser pending, {manual} manual, {failed} failed",
    settingsTitle: "Settings",
    settingsSubtitle: "Choose appearance, language, and download preferences.",
    appearance: "Appearance",
    appearanceHint: "This changes the backup app interface. Teams keeps its own theme setting.",
    appearanceHintSynced: "Changes both the backup controls and the embedded Teams page.",
    downloads: "Downloads",
    downloadsHint: "Choose where backups are created and how many files can download together.",
    backupFolder: "Backup folder",
    defaultDownloadsFolder: "Default Downloads folder",
    checkingTeams: "Checking Teams",
    teamsReady: "Ready",
    openChatToExport: "Open a chat",
    openChatsToExport: "Open Chats",
    signInRequired: "Sign in required",
    readyStatus: "Teams is ready. Choose an export action.",
    openChatStatus: "Teams is signed in. Open a chat to enable current-chat exports.",
    themeSystem: "Follow system",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
    languageHint: "The interface updates immediately and the selection is saved for future launches.",
    languageSystem: "System language",
    save: "Save",
    saved: "Saved",
    version: "Version {version}",
    systemDefault: "Default",
    progressStarting: "Starting Teams Web export...",
    progressExpandingChats: "Expanding the complete Teams chat list...",
    progressDownloading: "Downloading queued files...",
    progressComplete: "Export complete.",
    progressStopped: "Export stopped. Resume from this folder later.",
    progressStopRequested: "Stop requested.",
    progressResetting: "Resetting Teams session storage...",
    progressReset: "Teams session reset. Sign in again if prompted.",
    progressWaitingMessages: "Message export complete. Waiting for queued downloads...",
    progressWaitingShared: "Shared file export pass complete. Waiting for queued downloads..."
  };

  const dictionaries = {
    en,
    "zh-CN": {
      appName: "Teams 网页备份", initialStatus: "登录 Teams，打开聊天，然后开始导出。", teams: "Teams", reloadTeams: "重新加载 Teams", resetSession: "重置会话", folder: "文件夹", chooseFolder: "选择文件夹", openExport: "打开导出目录", concurrentThreads: "并发下载线程", exportChat: "导出聊天", exportFiles: "导出文件", currentChat: "当前聊天", allChats: "所有聊天", resume: "继续", resumeTitle: "从现有导出文件夹继续", stop: "停止", devTools: "开发工具", app: "应用", browser: "浏览器", settings: "设置", chats: "个聊天", messages: "条消息", queued: "排队中", files: "个文件", failed: "失败", queueItems: "队列项目", hideQueue: "隐藏队列", filesWaiting: "等待下载的文件", exportParentFolder: "导出父文件夹：{folder}", currentExportStarted: "已开始导出当前聊天：{folder}", allExportStarted: "已开始导出所有聊天：{folder}", currentFilesStarted: "已开始导出当前聊天的共享文件：{folder}", allFilesStarted: "已开始导出所有聊天的共享文件：{folder}", resumingExport: "正在继续导出：{folder}", downloadQueue: "下载队列", noQueuedItems: "没有排队项目。", refresh: "刷新", close: "关闭", nothingWaiting: "没有等待下载的项目。", copyUrl: "复制网址", copied: "已复制", open: "打开", statusQueued: "排队中", statusDownloading: "下载中", statusDownloaded: "已下载", statusFailed: "失败", statusManual: "手动", kindFile: "文件", kindImage: "图片", kindPdf: "PDF", kindAvatar: "头像", kindLink: "链接", diagnostics: "诊断", loadingDiagnostics: "正在加载诊断信息…", copy: "复制", clearView: "清除视图", noDiagnostics: "暂无诊断信息。", running: "运行中", notRunning: "未运行", yes: "是", no: "否", phase: "阶段", stopRequested: "已请求停止", lastProgress: "上次进度", teamsUrl: "Teams 地址", exportFolder: "导出文件夹", queue: "队列", queueUnavailable: "队列不可用", settingsTitle: "设置", settingsSubtitle: "选择应用外观和界面语言。", appearance: "外观", appearanceHint: "此设置只更改备份应用界面，Teams 使用自己的主题设置。", themeSystem: "跟随系统", themeLight: "浅色", themeDark: "深色", language: "语言", languageHint: "界面会立即更新，并保存设置供以后使用。", languageSystem: "系统语言", save: "保存", saved: "已保存", version: "版本 {version}", systemDefault: "默认", progressStarting: "正在开始 Teams 网页导出…", progressDownloading: "正在下载队列中的文件…", progressComplete: "导出完成。", progressStopped: "导出已停止。稍后可从此文件夹继续。", progressStopRequested: "已请求停止。", progressResetting: "正在重置 Teams 会话存储…", progressReset: "Teams 会话已重置。请按提示重新登录。", progressWaitingMessages: "消息导出完成，正在等待队列下载…", progressWaitingShared: "共享文件扫描完成，正在等待队列下载…"
    },
    "zh-TW": {
      appName: "Teams 網頁備份", initialStatus: "登入 Teams，開啟聊天，然後開始匯出。", teams: "Teams", reloadTeams: "重新載入 Teams", resetSession: "重設工作階段", folder: "資料夾", chooseFolder: "選擇資料夾", openExport: "開啟匯出目錄", concurrentThreads: "同時下載執行緒", exportChat: "匯出聊天", exportFiles: "匯出檔案", currentChat: "目前聊天", allChats: "所有聊天", resume: "繼續", resumeTitle: "從現有匯出資料夾繼續", stop: "停止", devTools: "開發工具", app: "應用程式", browser: "瀏覽器", settings: "設定", chats: "個聊天", messages: "則訊息", queued: "佇列中", files: "個檔案", failed: "失敗", queueItems: "佇列項目", hideQueue: "隱藏佇列", filesWaiting: "等待下載的檔案", exportParentFolder: "匯出上層資料夾：{folder}", currentExportStarted: "已開始匯出目前聊天：{folder}", allExportStarted: "已開始匯出所有聊天：{folder}", currentFilesStarted: "已開始匯出目前聊天的共享檔案：{folder}", allFilesStarted: "已開始匯出所有聊天的共享檔案：{folder}", resumingExport: "正在繼續匯出：{folder}", downloadQueue: "下載佇列", noQueuedItems: "沒有佇列項目。", refresh: "重新整理", close: "關閉", nothingWaiting: "沒有等待下載的項目。", copyUrl: "複製網址", copied: "已複製", open: "開啟", statusQueued: "佇列中", statusDownloading: "下載中", statusDownloaded: "已下載", statusFailed: "失敗", statusManual: "手動", kindFile: "檔案", kindImage: "圖片", kindPdf: "PDF", kindAvatar: "頭像", kindLink: "連結", diagnostics: "診斷", loadingDiagnostics: "正在載入診斷資訊…", copy: "複製", clearView: "清除畫面", noDiagnostics: "尚無診斷資訊。", running: "執行中", notRunning: "未執行", yes: "是", no: "否", phase: "階段", stopRequested: "已要求停止", lastProgress: "上次進度", teamsUrl: "Teams 網址", exportFolder: "匯出資料夾", queue: "佇列", queueUnavailable: "佇列無法使用", settingsTitle: "設定", settingsSubtitle: "選擇應用程式外觀和介面語言。", appearance: "外觀", appearanceHint: "此設定只會變更備份應用程式介面，Teams 使用自己的主題設定。", themeSystem: "跟隨系統", themeLight: "淺色", themeDark: "深色", language: "語言", languageHint: "介面會立即更新，並儲存設定供日後使用。", languageSystem: "系統語言", save: "儲存", saved: "已儲存", version: "版本 {version}", systemDefault: "預設", progressStarting: "正在開始 Teams 網頁匯出…", progressDownloading: "正在下載佇列中的檔案…", progressComplete: "匯出完成。", progressStopped: "匯出已停止。稍後可從此資料夾繼續。", progressStopRequested: "已要求停止。", progressResetting: "正在重設 Teams 工作階段儲存空間…", progressReset: "Teams 工作階段已重設。請依提示重新登入。", progressWaitingMessages: "訊息匯出完成，正在等待佇列下載…", progressWaitingShared: "共享檔案掃描完成，正在等待佇列下載…"
    },
    ja: {
      appName: "Teams Web バックアップ", initialStatus: "Teams にサインインし、チャットを開いてエクスポートを開始します。", teams: "Teams", reloadTeams: "Teams を再読み込み", resetSession: "セッションをリセット", folder: "フォルダー", chooseFolder: "フォルダーを選択", openExport: "エクスポートを開く", concurrentThreads: "同時ダウンロード数", exportChat: "チャットをエクスポート", exportFiles: "ファイルをエクスポート", currentChat: "現在のチャット", allChats: "すべてのチャット", resume: "再開", resumeTitle: "既存のエクスポートフォルダーから再開", stop: "停止", devTools: "開発者ツール", app: "アプリ", browser: "ブラウザー", settings: "設定", chats: "チャット", messages: "メッセージ", queued: "待機中", files: "ファイル", failed: "失敗", queueItems: "キュー項目", hideQueue: "キューを隠す", filesWaiting: "ダウンロード待ちのファイル", exportParentFolder: "エクスポート先：{folder}", currentExportStarted: "現在のチャットのエクスポートを開始：{folder}", allExportStarted: "すべてのチャットのエクスポートを開始：{folder}", currentFilesStarted: "現在のチャットの共有ファイルを開始：{folder}", allFilesStarted: "すべてのチャットの共有ファイルを開始：{folder}", resumingExport: "エクスポートを再開中：{folder}", downloadQueue: "ダウンロードキュー", noQueuedItems: "待機中の項目はありません。", refresh: "更新", close: "閉じる", nothingWaiting: "ダウンロード待ちの項目はありません。", copyUrl: "URL をコピー", copied: "コピー済み", open: "開く", statusQueued: "待機中", statusDownloading: "ダウンロード中", statusDownloaded: "完了", statusFailed: "失敗", statusManual: "手動", kindFile: "ファイル", kindImage: "画像", kindPdf: "PDF", kindAvatar: "アバター", kindLink: "リンク", diagnostics: "診断", loadingDiagnostics: "診断情報を読み込み中…", copy: "コピー", clearView: "表示を消去", noDiagnostics: "診断情報はありません。", running: "実行中", notRunning: "停止中", yes: "はい", no: "いいえ", phase: "フェーズ", stopRequested: "停止要求", lastProgress: "最終進行", teamsUrl: "Teams URL", exportFolder: "エクスポートフォルダー", queue: "キュー", queueUnavailable: "キューを利用できません", settingsTitle: "設定", settingsSubtitle: "アプリの外観と言語を選択します。", appearance: "外観", appearanceHint: "バックアップアプリの画面だけを変更します。Teams のテーマ設定は別です。", themeSystem: "システムに合わせる", themeLight: "ライト", themeDark: "ダーク", language: "言語", languageHint: "画面はすぐに更新され、次回以降も設定が保持されます。", languageSystem: "システム言語", save: "保存", saved: "保存しました", version: "バージョン {version}", systemDefault: "既定", progressStarting: "Teams Web エクスポートを開始しています…", progressDownloading: "キュー内のファイルをダウンロードしています…", progressComplete: "エクスポートが完了しました。", progressStopped: "エクスポートを停止しました。後でこのフォルダーから再開できます。", progressStopRequested: "停止を要求しました。", progressResetting: "Teams セッションをリセットしています…", progressReset: "Teams セッションをリセットしました。必要に応じて再度サインインしてください。", progressWaitingMessages: "メッセージのエクスポートが完了しました。ダウンロードを待っています…", progressWaitingShared: "共有ファイルの処理が完了しました。ダウンロードを待っています…"
    },
    es: {
      appName: "Copia de seguridad de Teams Web", initialStatus: "Inicia sesión en Teams, abre Chats y comienza una exportación.", teams: "Teams", reloadTeams: "Recargar Teams", resetSession: "Restablecer sesión", folder: "Carpeta", chooseFolder: "Elegir carpeta", openExport: "Abrir exportación", concurrentThreads: "Descargas simultáneas", exportChat: "Exportar chats", exportFiles: "Exportar archivos", currentChat: "Chat actual", allChats: "Todos los chats", resume: "Reanudar", resumeTitle: "Reanudar desde una carpeta de exportación existente", stop: "Detener", devTools: "Herramientas", app: "Aplicación", browser: "Navegador", settings: "Configuración", chats: "chats", messages: "mensajes", queued: "en cola", files: "archivos", failed: "fallidos", queueItems: "Elementos en cola", hideQueue: "Ocultar cola", filesWaiting: "Archivos pendientes de descarga", exportParentFolder: "Carpeta de exportación: {folder}", currentExportStarted: "Exportación del chat actual iniciada: {folder}", allExportStarted: "Exportación de todos los chats iniciada: {folder}", currentFilesStarted: "Exportación de archivos del chat actual iniciada: {folder}", allFilesStarted: "Exportación de archivos de todos los chats iniciada: {folder}", resumingExport: "Reanudando exportación: {folder}", downloadQueue: "Cola de descargas", noQueuedItems: "No hay elementos en cola.", refresh: "Actualizar", close: "Cerrar", nothingWaiting: "No hay nada pendiente de descarga.", copyUrl: "Copiar URL", copied: "Copiado", open: "Abrir", statusQueued: "en cola", statusDownloading: "descargando", statusDownloaded: "descargado", statusFailed: "fallido", statusManual: "manual", kindFile: "archivo", kindImage: "imagen", kindPdf: "PDF", kindAvatar: "avatar", kindLink: "enlace", diagnostics: "Diagnóstico", loadingDiagnostics: "Cargando diagnóstico…", copy: "Copiar", clearView: "Limpiar vista", noDiagnostics: "Aún no hay diagnóstico.", running: "En ejecución", notRunning: "Detenido", yes: "sí", no: "no", phase: "Fase", stopRequested: "Detención solicitada", lastProgress: "Último progreso", teamsUrl: "URL de Teams", exportFolder: "Carpeta de exportación", queue: "Cola", queueUnavailable: "cola no disponible", settingsTitle: "Configuración", settingsSubtitle: "Elige la apariencia y el idioma de la aplicación.", appearance: "Apariencia", appearanceHint: "Esto cambia la interfaz de la aplicación. Teams conserva su propio tema.", themeSystem: "Seguir el sistema", themeLight: "Claro", themeDark: "Oscuro", language: "Idioma", languageHint: "La interfaz se actualiza al instante y la selección se guarda.", languageSystem: "Idioma del sistema", save: "Guardar", saved: "Guardado", version: "Versión {version}", systemDefault: "Predeterminado", progressStarting: "Iniciando exportación de Teams Web…", progressDownloading: "Descargando archivos en cola…", progressComplete: "Exportación completada.", progressStopped: "Exportación detenida. Puedes reanudarla desde esta carpeta.", progressStopRequested: "Detención solicitada.", progressResetting: "Restableciendo la sesión de Teams…", progressReset: "Sesión de Teams restablecida. Inicia sesión de nuevo si se solicita.", progressWaitingMessages: "Mensajes exportados. Esperando las descargas…", progressWaitingShared: "Archivos compartidos procesados. Esperando las descargas…"
    },
    fr: {
      appName: "Sauvegarde Teams Web", initialStatus: "Connectez-vous à Teams, ouvrez les conversations, puis lancez une exportation.", teams: "Teams", reloadTeams: "Recharger Teams", resetSession: "Réinitialiser la session", folder: "Dossier", chooseFolder: "Choisir un dossier", openExport: "Ouvrir l’exportation", concurrentThreads: "Téléchargements simultanés", exportChat: "Exporter les conversations", exportFiles: "Exporter les fichiers", currentChat: "Conversation actuelle", allChats: "Toutes les conversations", resume: "Reprendre", resumeTitle: "Reprendre depuis un dossier d’exportation existant", stop: "Arrêter", devTools: "Outils de développement", app: "Application", browser: "Navigateur", settings: "Paramètres", chats: "conversations", messages: "messages", queued: "en attente", files: "fichiers", failed: "échecs", queueItems: "File d’attente", hideQueue: "Masquer la file", filesWaiting: "Fichiers en attente", downloadQueue: "File de téléchargement", noQueuedItems: "Aucun élément en attente.", refresh: "Actualiser", close: "Fermer", nothingWaiting: "Aucun téléchargement en attente.", copyUrl: "Copier l’URL", copied: "Copié", open: "Ouvrir", statusQueued: "en attente", statusDownloading: "téléchargement", statusDownloaded: "téléchargé", statusFailed: "échec", statusManual: "manuel", kindFile: "fichier", kindImage: "image", kindPdf: "PDF", kindAvatar: "avatar", kindLink: "lien", diagnostics: "Diagnostic", loadingDiagnostics: "Chargement du diagnostic…", copy: "Copier", clearView: "Effacer", noDiagnostics: "Aucun diagnostic.", running: "En cours", notRunning: "Arrêté", yes: "oui", no: "non", phase: "Phase", stopRequested: "Arrêt demandé", lastProgress: "Dernière progression", teamsUrl: "URL Teams", exportFolder: "Dossier d’exportation", queue: "File", queueUnavailable: "file indisponible", settingsTitle: "Paramètres", settingsSubtitle: "Choisissez l’apparence et la langue de l’application.", appearance: "Apparence", appearanceHint: "Ce réglage modifie l’interface de sauvegarde. Teams conserve son propre thème.", themeSystem: "Suivre le système", themeLight: "Clair", themeDark: "Sombre", language: "Langue", languageHint: "L’interface se met à jour immédiatement et le choix est mémorisé.", languageSystem: "Langue du système", save: "Enregistrer", saved: "Enregistré", version: "Version {version}", systemDefault: "Par défaut", progressStarting: "Démarrage de l’exportation Teams Web…", progressDownloading: "Téléchargement des fichiers en attente…", progressComplete: "Exportation terminée.", progressStopped: "Exportation arrêtée. Vous pourrez la reprendre depuis ce dossier.", progressStopRequested: "Arrêt demandé."
    },
    de: {
      appName: "Teams Web Backup", initialStatus: "Bei Teams anmelden, Chats öffnen und den Export starten.", teams: "Teams", reloadTeams: "Teams neu laden", resetSession: "Sitzung zurücksetzen", folder: "Ordner", chooseFolder: "Ordner wählen", openExport: "Export öffnen", concurrentThreads: "Gleichzeitige Downloads", exportChat: "Chats exportieren", exportFiles: "Dateien exportieren", currentChat: "Aktueller Chat", allChats: "Alle Chats", resume: "Fortsetzen", resumeTitle: "Aus einem vorhandenen Exportordner fortsetzen", stop: "Stoppen", devTools: "Entwicklertools", app: "App", browser: "Browser", settings: "Einstellungen", chats: "Chats", messages: "Nachrichten", queued: "wartend", files: "Dateien", failed: "fehlgeschlagen", queueItems: "Warteschlange", hideQueue: "Warteschlange ausblenden", filesWaiting: "Dateien warten auf Download", downloadQueue: "Download-Warteschlange", noQueuedItems: "Keine wartenden Elemente.", refresh: "Aktualisieren", close: "Schließen", nothingWaiting: "Keine Downloads warten.", copyUrl: "URL kopieren", copied: "Kopiert", open: "Öffnen", statusQueued: "wartend", statusDownloading: "wird geladen", statusDownloaded: "geladen", statusFailed: "fehlgeschlagen", statusManual: "manuell", kindFile: "Datei", kindImage: "Bild", kindPdf: "PDF", kindAvatar: "Avatar", kindLink: "Link", diagnostics: "Diagnose", loadingDiagnostics: "Diagnose wird geladen…", copy: "Kopieren", clearView: "Ansicht leeren", noDiagnostics: "Noch keine Diagnose.", running: "Läuft", notRunning: "Nicht aktiv", yes: "ja", no: "nein", phase: "Phase", stopRequested: "Stopp angefordert", lastProgress: "Letzter Fortschritt", teamsUrl: "Teams-URL", exportFolder: "Exportordner", queue: "Warteschlange", queueUnavailable: "Warteschlange nicht verfügbar", settingsTitle: "Einstellungen", settingsSubtitle: "Darstellung und Sprache der App auswählen.", appearance: "Darstellung", appearanceHint: "Dies ändert die Backup-App. Teams verwendet seine eigene Designeinstellung.", themeSystem: "Systemeinstellung", themeLight: "Hell", themeDark: "Dunkel", language: "Sprache", languageHint: "Die Oberfläche wird sofort aktualisiert und die Auswahl gespeichert.", languageSystem: "Systemsprache", save: "Speichern", saved: "Gespeichert", version: "Version {version}", systemDefault: "Standard", progressStarting: "Teams-Web-Export wird gestartet…", progressDownloading: "Dateien aus der Warteschlange werden geladen…", progressComplete: "Export abgeschlossen.", progressStopped: "Export gestoppt. Später aus diesem Ordner fortsetzen.", progressStopRequested: "Stopp angefordert."
    },
    "pt-BR": {
      appName: "Backup do Teams Web", initialStatus: "Entre no Teams, abra Chats e inicie uma exportação.", teams: "Teams", reloadTeams: "Recarregar Teams", resetSession: "Redefinir sessão", folder: "Pasta", chooseFolder: "Escolher pasta", openExport: "Abrir exportação", concurrentThreads: "Downloads simultâneos", exportChat: "Exportar chats", exportFiles: "Exportar arquivos", currentChat: "Chat atual", allChats: "Todos os chats", resume: "Retomar", resumeTitle: "Retomar de uma pasta de exportação existente", stop: "Parar", devTools: "Ferramentas", app: "Aplicativo", browser: "Navegador", settings: "Configurações", chats: "chats", messages: "mensagens", queued: "na fila", files: "arquivos", failed: "falhas", queueItems: "Itens na fila", hideQueue: "Ocultar fila", filesWaiting: "Arquivos aguardando download", downloadQueue: "Fila de downloads", noQueuedItems: "Nenhum item na fila.", refresh: "Atualizar", close: "Fechar", nothingWaiting: "Nada aguardando download.", copyUrl: "Copiar URL", copied: "Copiado", open: "Abrir", statusQueued: "na fila", statusDownloading: "baixando", statusDownloaded: "baixado", statusFailed: "falhou", statusManual: "manual", kindFile: "arquivo", kindImage: "imagem", kindPdf: "PDF", kindAvatar: "avatar", kindLink: "link", diagnostics: "Diagnóstico", loadingDiagnostics: "Carregando diagnóstico…", copy: "Copiar", clearView: "Limpar", noDiagnostics: "Nenhum diagnóstico ainda.", running: "Em execução", notRunning: "Parado", yes: "sim", no: "não", phase: "Fase", stopRequested: "Parada solicitada", lastProgress: "Último progresso", teamsUrl: "URL do Teams", exportFolder: "Pasta de exportação", queue: "Fila", queueUnavailable: "fila indisponível", settingsTitle: "Configurações", settingsSubtitle: "Escolha a aparência e o idioma do aplicativo.", appearance: "Aparência", appearanceHint: "Isso altera a interface do backup. O Teams mantém seu próprio tema.", themeSystem: "Seguir o sistema", themeLight: "Claro", themeDark: "Escuro", language: "Idioma", languageHint: "A interface muda imediatamente e a escolha fica salva.", languageSystem: "Idioma do sistema", save: "Salvar", saved: "Salvo", version: "Versão {version}", systemDefault: "Padrão", progressStarting: "Iniciando exportação do Teams Web…", progressDownloading: "Baixando arquivos da fila…", progressComplete: "Exportação concluída.", progressStopped: "Exportação parada. Retome depois por esta pasta.", progressStopRequested: "Parada solicitada."
    },
    ko: {
      appName: "Teams 웹 백업", initialStatus: "Teams에 로그인하고 채팅을 연 다음 내보내기를 시작하세요.", teams: "Teams", reloadTeams: "Teams 새로 고침", resetSession: "세션 초기화", folder: "폴더", chooseFolder: "폴더 선택", openExport: "내보내기 열기", concurrentThreads: "동시 다운로드 수", exportChat: "채팅 내보내기", exportFiles: "파일 내보내기", currentChat: "현재 채팅", allChats: "모든 채팅", resume: "계속", resumeTitle: "기존 내보내기 폴더에서 계속", stop: "중지", devTools: "개발자 도구", app: "앱", browser: "브라우저", settings: "설정", chats: "채팅", messages: "메시지", queued: "대기 중", files: "파일", failed: "실패", queueItems: "대기 항목", hideQueue: "대기열 숨기기", filesWaiting: "다운로드 대기 파일", downloadQueue: "다운로드 대기열", noQueuedItems: "대기 항목이 없습니다.", refresh: "새로 고침", close: "닫기", nothingWaiting: "다운로드 대기 항목이 없습니다.", copyUrl: "URL 복사", copied: "복사됨", open: "열기", statusQueued: "대기 중", statusDownloading: "다운로드 중", statusDownloaded: "완료", statusFailed: "실패", statusManual: "수동", kindFile: "파일", kindImage: "이미지", kindPdf: "PDF", kindAvatar: "프로필", kindLink: "링크", diagnostics: "진단", loadingDiagnostics: "진단 정보 불러오는 중…", copy: "복사", clearView: "화면 지우기", noDiagnostics: "진단 정보가 없습니다.", running: "실행 중", notRunning: "중지됨", yes: "예", no: "아니요", phase: "단계", stopRequested: "중지 요청", lastProgress: "마지막 진행", teamsUrl: "Teams URL", exportFolder: "내보내기 폴더", queue: "대기열", queueUnavailable: "대기열 사용 불가", settingsTitle: "설정", settingsSubtitle: "앱의 모양과 언어를 선택하세요.", appearance: "모양", appearanceHint: "백업 앱 화면만 변경됩니다. Teams 테마는 별도 설정입니다.", themeSystem: "시스템 설정 사용", themeLight: "라이트", themeDark: "다크", language: "언어", languageHint: "화면이 즉시 바뀌며 다음 실행에도 설정이 유지됩니다.", languageSystem: "시스템 언어", save: "저장", saved: "저장됨", version: "버전 {version}", systemDefault: "기본값", progressStarting: "Teams 웹 내보내기를 시작하는 중…", progressDownloading: "대기 중인 파일을 다운로드하는 중…", progressComplete: "내보내기가 완료되었습니다.", progressStopped: "내보내기를 중지했습니다. 나중에 이 폴더에서 계속할 수 있습니다.", progressStopRequested: "중지를 요청했습니다."
    }
  };

  const supported = Object.keys(dictionaries);
  let preferences = { theme: "system", language: "system" };
  let locale = "en";

  function resolveLocale(value) {
    if (value && value !== "system" && supported.includes(value)) return value;
    const systemLocale = navigator.language || "en";
    if (/^zh-(TW|HK|MO)/i.test(systemLocale)) return "zh-TW";
    if (/^zh/i.test(systemLocale)) return "zh-CN";
    if (/^pt/i.test(systemLocale)) return "pt-BR";
    const exact = supported.find((item) => item.toLowerCase() === systemLocale.toLowerCase());
    if (exact) return exact;
    const language = systemLocale.split("-")[0].toLowerCase();
    return supported.find((item) => item.toLowerCase() === language) || "en";
  }

  function t(key, params = {}) {
    const template = dictionaries[locale]?.[key] ?? en[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_match, name) => params[name] ?? `{${name}}`);
  }

  function applyDocument() {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = locale;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = t(element.dataset.i18nTitle);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
    window.dispatchEvent(new CustomEvent("teams-backup-locale-changed", { detail: { preferences, locale } }));
  }

  function setPreferences(value) {
    preferences = {
      theme: ["system", "light", "dark"].includes(value?.theme) ? value.theme : "system",
      language: value?.language || "system"
    };
    locale = resolveLocale(preferences.language);
    applyDocument();
  }

  window.TeamsBackupI18n = {
    t,
    setPreferences,
    getPreferences: () => ({ ...preferences }),
    getLocale: () => locale,
    resolveLocale,
    supported
  };
})();
