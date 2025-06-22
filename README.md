# Text - Lyrics Assistant for Musicians

Text is a web-based application designed to help musicians display and follow lyrics while performing or practicing songs. It provides a clean, full-screen lyrics display synchronized with audio playback.

## Features

### Current Features (v1.0)
- **Full-screen lyrics display** with teleprompter-style scrolling
- **Dual track support** for instrumental and vocal tracks
- **Independent volume controls** for backing track and vocals
- **Basic transport controls** (play, pause, next/previous track)
- **Local track catalog** with persistent storage
- **File upload system** for tracks and lyrics
- **Keyboard shortcuts** for quick control during performance

### Planned Features
- Advanced lyrics synchronization (karaoke-style word highlighting)
- Loop functionality for section practice
- BPM adjustment for slowing down during practice
- Pitch/key adjustment (transposition)
- Track recognition and automatic lyrics fetching
- Advanced waveform visualization and navigation

## Backup & Restore System

The application includes a comprehensive backup and restore system to protect your work:

### Backup Features

- **Manual Backups**: Create backups of your tracks at any time
  - **Metadata-only Backups**: Small JSON files containing track information and markers
  - **Full Track Backups**: ZIP files containing track metadata, markers, and audio files
  
- **Automatic Backups**: System automatically creates backups every 30 minutes
  - Stores up to 10 most recent automatic backups
  - Accessible through the Restore dialog

### Restoring Data

You can restore your tracks from:
- Previously downloaded backup files (.json or .zip)
- Automatic backups stored in the browser

### How to Use

1. **Create Backups**:
   - Click the "Backup" button in the header
   - Choose between backing up all tracks (metadata only) or a single track with audio

2. **Restore Tracks**:
   - Click the "Restore" button in the header
   - Upload a previously downloaded backup file or select from automatic backups
   - The system will restore tracks while preserving any existing data

### Security Considerations

- Automatic backups are stored securely in the browser's IndexedDB storage
- Manual backups should be stored in a secure location (cloud storage recommended)
- For production use on a server, additional server-side backup mechanisms will be implemented

## Usage

### Getting Started
1. Open the application in a web browser
2. Click the "Catalog" button to open the track management panel
3. Upload your tracks and lyrics files
4. Select a track to begin playback

### Keyboard Shortcuts
- **Space**: Play/Pause
- **Ctrl+Left Arrow**: Previous track
- **Ctrl+Right Arrow**: Next track
- **Escape**: Close catalog view

## Technical Details

Text is built using modern web technologies:
- **HTML5**: Structure and semantic markup
- **CSS3**: Styling and animations
- **JavaScript**: Core functionality and audio processing
- **Web Audio API**: Advanced audio handling and manipulation
- **IndexedDB**: Local persistent storage for track catalog

## Installation

Text runs directly in the browser with no server-side dependencies. Simply open the `index.html` file in a web browser to use the application.

## Development

This project is still in development. Contributions and suggestions are welcome!

## License

This project is licensed under the MIT License - see the LICENSE file for details. 