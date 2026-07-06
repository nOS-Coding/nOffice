use tracing_subscriber::EnvFilter;

pub fn init_logging() {
    let log_dir = dirs::home_dir()
        .unwrap_or_default()
        .join(".noffice/logs");
    std::fs::create_dir_all(&log_dir).ok();

    let file_path = log_dir.join(format!("noffice-{}.log", chrono_now()));
    let file = std::fs::File::create(file_path).ok();
    let file_writer = file.map(|f| std::sync::Mutex::new(f));

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_writer(move || {
            if let Some(ref writer) = file_writer {
                Box::new(writer.lock().unwrap()) as Box<dyn std::io::Write>
            } else {
                Box::new(std::io::stdout()) as Box<dyn std::io::Write>
            }
        })
        .init();
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", now)
}
