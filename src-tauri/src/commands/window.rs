use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tracing::info;

#[tauri::command]
pub async fn open_app_window(app_handle: AppHandle, app_id: String) -> Result<(), String> {
    let label = format!("noffice-{}", app_id);

    if let Some(window) = app_handle.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let (title, url, width, height, min_width, min_height) = match app_id.as_str() {
        "nwrite" => ("nWrite", "/nwrite", 1280, 900, 800, 600),
        "nsheet" => ("nSheet", "/nsheet", 1400, 900, 900, 600),
        "nslides" => ("nSlides", "/nslides", 1280, 800, 800, 600),
        "nimg" => ("nImg", "/nimg", 1280, 900, 800, 600),
        "ncode" => ("nCode", "/ncode", 1400, 950, 900, 600),
        _ => return Err(format!("Unknown app: {}", app_id)),
    };

    let window = WebviewWindowBuilder::new(&app_handle, &label, WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(width as f64, height as f64)
        .min_inner_size(min_width as f64, min_height as f64)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    info!("Opened app window: {} ({})", title, label);

    // Set up native menu
    if let Err(e) = setup_app_menu(&window, &app_id) {
        tracing::error!("Failed to set up menu for {}: {}", app_id, e);
    }

    Ok(())
}

fn setup_app_menu(
    _window: &tauri::WebviewWindow,
    _app_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        use tauri::menu::{MenuBuilder, SubmenuBuilder};
        let app = _window.app_handle();
        let app_name = format!("n{}", &_app_id[1..]);

        let file_menu = SubmenuBuilder::new(app, "File")
            .text("new", "New")
            .text("open", "Open...")
            .separator()
            .text("save", "Save")
            .text("save-as", "Save As...")
            .separator()
            .text("close", "Close Window")
            .build()?;

        let edit_menu = SubmenuBuilder::new(app, "Edit")
            .undo()
            .redo()
            .separator()
            .cut()
            .copy()
            .paste()
            .select_all()
            .build()?;

        let view_menu = SubmenuBuilder::new(app, "View")
            .text("toggle-sidebar", "Toggle AI Sidebar")
            .separator()
            .text("zoom-in", "Zoom In")
            .text("zoom-out", "Zoom Out")
            .text("zoom-reset", "Reset Zoom")
            .build()?;

        let menu = MenuBuilder::new(app)
            .item(&SubmenuBuilder::new(app, &app_name).text("about", "About nOffice").build()?)
            .item(&file_menu)
            .item(&edit_menu)
            .item(&view_menu)
            .item(&SubmenuBuilder::new(app, "Window").text("minimize", "Minimize").text("zoom", "Zoom").build()?)
            .item(&SubmenuBuilder::new(app, "Help").text("help", "nOffice Help").build()?)
            .build()?;

        _window.set_menu(menu)?;

        // Handle menu events by emitting to the frontend
        let w = _window.clone();
        _window.on_menu_event(move |_win, event| {
            let id = event.id();
            let id_str = id.as_ref();
            match id_str {
                "close" | "minimize" => {
                    let _ = w.hide();
                }
                "toggle-sidebar" => {
                    let _ = w.emit("menu:toggle-sidebar", ());
                }
                _ => {
                    let _ = w.emit("menu:action", id_str);
                }
            }
        });
    }

    Ok(())
}
