export const documentWorkspaceCss = `
.nf.nf-workspace{max-width:1120px;margin:0 auto;padding:8px 0 32px;font-size:14px;--nf-line:#dce6eb;--nf-muted:#596f7f}
.nf-workspace h1,.nf-workspace h2,.nf-workspace h3{font-family:inherit;letter-spacing:-.025em}
.nf-workspace h1{font-size:clamp(21px,2vw,28px);font-weight:700;line-height:1.3;max-width:38ch}
.nf-workspace h2{font-size:20px;line-height:1.4}
.nf-workspace h3{font-size:15px;line-height:1.4}
.nf-workspace-header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:0 0 14px}
.nf-document-copy{min-width:0}.nf-document-meta{font-size:12px;line-height:1.6;margin-bottom:5px!important;color:var(--nf-muted)}
.nf-workspace .nf-picker-toggle{flex-shrink:0;border-color:var(--nf-line);background:var(--nf-base);font-size:13px;padding:9px 14px}
.nf-picker{background:var(--nf-base);border:1px solid var(--nf-line);border-radius:14px;padding:20px;margin-bottom:20px}
.nf-picker-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;align-items:end}
.nf-picker-filters label{font-size:12px;margin-bottom:6px}.nf-picker-filters .nf-labelrow{margin-bottom:0}
.nf-picker .nf-list{grid-template-columns:repeat(2,minmax(0,1fr));padding:14px 0 0;max-height:320px;gap:5px 12px}
.nf-picker .nf-list button{padding:10px 12px;border-radius:7px;line-height:1.5;font-size:13px}
.nf-picker .nf-list button[aria-pressed=true]{border-color:#b7d8ce;background:#edf6f2;color:#155c50}
.nf-picker-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--nf-line);margin-top:14px;padding-top:12px;color:var(--nf-muted);font-size:12px}
.nf-picker-footer button{font-size:12px;padding:7px 12px;min-height:36px}
.nf-mode-bar{display:flex;align-items:center;gap:8px;margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid var(--nf-line);font-size:13px;color:var(--nf-muted)}
.nf-mode-bar button,.nf-mode-bar span{display:inline-flex;align-items:center;gap:8px}
.nf-mode-bar button{border:0;background:transparent;font-size:13px;border-radius:6px;min-height:38px;padding:7px 12px;color:var(--nf-muted)}
.nf-mode-bar [aria-current=step],.nf-mode-bar [aria-selected=true]{background:#e7f2ed;color:#145e50;font-weight:700}
.nf-editor{background:var(--nf-base);border:1px solid var(--nf-line);border-radius:16px;padding:20px}
.nf-editor-overview{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:8px}
.nf-editor-overview p{font-size:13px;line-height:1.6;margin-top:4px}
.nf-progress-compact{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--nf-muted);flex-shrink:0}
.nf-progress-compact progress{width:92px;height:6px;accent-color:var(--nf-accent);border-radius:5px;overflow:hidden}
.nf-progress-compact progress::-webkit-progress-bar{background:var(--nf-line)}
.nf-progress-compact progress::-webkit-progress-value{background:var(--nf-accent)}
.nf-autofill-inline{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 12px;padding:0 0 8px;border-bottom:1px solid var(--nf-line);font-size:12px;color:var(--nf-muted)}
.nf-autofill-inline p,.nf-autofill-inline strong{font-size:12px;font-weight:400;color:var(--nf-muted)}
.nf-autofill-inline button{padding:6px 0 6px 10px;min-height:36px;background:transparent;border:0;color:var(--nf-accent);font-size:12px;font-weight:600}
.nf-workspace .nf-toolbar{margin:0 0 12px;gap:16px;align-items:center}
.nf-workspace .nf-searchfields label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.nf-workspace .nf-searchfields input{font-size:13px;min-height:42px;padding:9px 12px;background:var(--nf-soft)}
.nf-workspace .nf-filter{font-size:12px;gap:7px;align-self:end;min-height:42px}
.nf-sections{border:1px solid var(--nf-line);border-radius:12px;overflow:visible}
.nf-section-card{border-top:1px solid var(--nf-line)}
.nf-section-card:first-child{border-top:0;border-radius:12px 12px 0 0}
.nf-section-card:last-child{border-radius:0 0 12px 12px}
.nf-section-card>h3{margin:0;letter-spacing:0}
.nf-workspace .nf-section-toggle{display:flex;width:100%;align-items:center;gap:12px;text-align:left;border:0;border-radius:0;background:transparent;min-height:54px;padding:13px 18px;font-weight:600}
.nf-section-card:first-child .nf-section-toggle{border-radius:12px 12px 0 0}
.nf-section-card:last-child:not(.is-open) .nf-section-toggle{border-radius:0 0 12px 12px}
.nf-workspace .nf-section-toggle:hover{background:var(--nf-soft)}
.nf-section-card.is-open .nf-section-toggle{color:var(--nf-accent);background:#f0f7f4}
.nf-section-title{flex:1;min-width:0;font-size:14px}
.nf-section-count{color:var(--nf-muted);font-size:12px;font-weight:400;white-space:nowrap}
.nf-chevron{display:inline-flex;justify-content:center;align-items:center;width:18px;flex-shrink:0;color:var(--nf-muted);font-size:16px}
.nf-section-body{padding:16px 18px 18px;scroll-margin-top:110px}
.nf-workspace .nf-fields{gap:20px 24px}
.nf-workspace .nf-field{min-width:0}
.nf-workspace .nf-field label{font-size:13px;font-weight:600;line-height:1.5}
.nf-workspace .nf-labelrow{align-items:center;margin-bottom:7px}
.nf-workspace .nf-field input,.nf-workspace .nf-field select,.nf-workspace .nf-field textarea{border-color:#c5d2da;font-size:14px;border-radius:7px;min-height:44px;padding:10px 12px}
.nf-workspace .nf-field textarea{line-height:1.65}
.nf-workspace .nf-field input:hover,.nf-workspace .nf-field select:hover,.nf-workspace .nf-field textarea:hover{border-color:#90a99e}
.nf-workspace .nf-source,.nf-workspace .nf-manual{font-size:11px;line-height:1.4;margin-top:5px}
.nf-workspace .nf-help summary{width:20px;height:20px;font-size:11px;border-color:#ccd8df;color:#728692}
.nf-workspace .nf-help summary:hover{color:var(--nf-accent);border-color:var(--nf-accent)}
.nf-workspace .nf-help-text{z-index:10;font-size:12px;line-height:1.6;border-color:var(--nf-line);box-shadow:0 8px 28px #1230471c}
.nf-workspace .nf-help-text p{max-width:none}
.nf-workspace .nf-section-next{display:block;margin:18px 0 0 auto;font-size:12px;min-height:40px;padding:8px 12px;color:var(--nf-accent)}
.nf-section-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;padding-top:14px;border-top:1px solid var(--nf-line);color:var(--nf-muted);font-size:12px}
.nf-section-pagination button{min-height:38px;font-size:12px;padding:8px 12px}
.nf-workspace .nf-field .nf-multiple input[type=checkbox]{width:18px;height:18px;min-height:18px;padding:0;flex:0 0 18px}
.nf-open-pdf{display:inline-block;font-size:12px;color:var(--nf-accent);font-weight:600;text-decoration:underline;text-underline-offset:3px;padding:9px 0}
.nf-search-results{border:1px solid var(--nf-line);border-radius:12px;padding:18px}
.nf-search-results .nf-section{padding-top:18px;margin-bottom:16px}
.nf-search-results .nf-section:first-child{border-top:0;padding-top:0}
.nf-search-results legend{font-size:13px}
.nf-images-disclosure{margin-top:18px;border-top:1px solid var(--nf-line);padding-top:4px;scroll-margin-top:100px}
.nf-images-disclosure>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;padding:15px 0;min-height:52px;color:var(--nf-muted);font-size:13px}
.nf-images-disclosure>summary::-webkit-details-marker{display:none}
.nf-images-disclosure>summary:after{content:'+';font-size:20px;line-height:1;color:var(--nf-accent)}
.nf-images-disclosure[open]>summary:after{content:'−'}
.nf-images-disclosure>summary strong{font-size:13px;font-weight:600;color:var(--nf-ink)}
.nf-images-disclosure>summary small{font-size:12px;font-weight:400}
.nf-images-content{padding:0 0 12px}.nf-images-content>p{font-size:12px}
.nf-images-content>.nf-fields{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.nf-image-card{background:var(--nf-soft);padding:14px;border-radius:8px;font-size:12px}
.nf-image-card img{width:100%;height:120px;object-fit:contain;margin:10px 0}
.nf-image-card button{font-size:12px;min-height:38px;padding:7px 10px}
.nf-image-card .nf-actions{gap:6px}
.nf-image-card .nf-labelrow strong{font-size:13px}
.nf-edit-actions{position:sticky;bottom:14px;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:18px;background:var(--nf-base);padding:12px 16px;margin:20px -1px 0;border:1px solid var(--nf-line);border-radius:12px;box-shadow:0 5px 24px #1732470a}
.nf-edit-actions .nf-count{margin-top:4px!important}
.nf-draft-note{font-size:12px;line-height:1.6;color:var(--nf-muted);max-width:48ch}
.nf-draft-note p{font-size:12px}.nf-draft-note strong{display:block;font-size:13px;color:var(--nf-ink);font-weight:600}
.nf-action-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-shrink:0}
.nf-action-buttons button{font-size:13px;padding:10px 16px;min-height:44px}
.nf-workspace button.nf-primary{background:var(--nf-accent);border-color:var(--nf-accent);color:#fff}
.nf-workspace button.nf-primary:hover{background:#12594e}
.nf-review-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
.nf-review-topbar button{font-size:13px;min-height:40px;padding:8px 12px;background:var(--nf-base)}
.nf-review-layout{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:20px;align-items:start}
.nf-preview-stage{min-width:0;overflow:hidden;min-height:620px;border:1px solid var(--nf-line);border-radius:12px;background:#e9eef2}
.nf-preview-stage iframe{display:block;width:100%;height:clamp(620px,78vh,880px);border:0;background:white}
.nf-preview-placeholder{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;min-height:620px;padding:36px;text-align:center;color:var(--nf-muted)}
.nf-preview-placeholder p{font-size:13px;max-width:38ch;line-height:1.7}
.nf-review-summary{position:sticky;top:96px;background:var(--nf-base);padding:20px;border:1px solid var(--nf-line);border-radius:12px}
.nf-review-summary h2,.nf-review-summary h3{font-size:17px;margin-bottom:10px}
.nf-review-summary p{font-size:12px;line-height:1.7}
.nf-review-summary .nf-progress-compact{margin-bottom:14px;flex-wrap:wrap}
.nf-review-summary .nf-draft-note{padding:12px;background:#fbf6ec;border-radius:7px;color:#6f5830;margin:14px 0}
.nf-review-downloads{display:grid;gap:9px;margin-top:18px}
.nf-review-downloads button{width:100%;font-size:13px;min-height:44px;padding:10px 12px}
.nf-review-save{border-top:1px solid var(--nf-line);margin-top:18px;padding-top:14px;display:grid;gap:8px}
.nf-review-save button{font-size:12px;min-height:38px;padding:8px 10px}
.nf-review-save .nf-count{font-size:11px}
.nf-workspace [hidden]{display:none!important}
.dark .nf.nf-workspace{--nf-ink:#e1edf5;--nf-muted:#b6c8d3;--nf-line:#40586a;--nf-base:#172b3a;--nf-soft:#203849}
.dark .nf-autofill-inline button,.dark .nf-open-pdf{color:#9cdec9}
.high-contrast .nf.nf-workspace{--nf-ink:#061626;--nf-muted:#263b4d;--nf-line:#556b7a}
.dark.high-contrast .nf.nf-workspace{--nf-ink:#ffffff;--nf-muted:#edf4f8;--nf-line:#a2b5c2}
.dark .nf-workspace .nf-section-card.is-open .nf-section-toggle,.dark .nf-workspace .nf-mode-bar [aria-current=step]{background:#1d433b;color:#b0dfcf}
.dark .nf-workspace .nf-picker .nf-list button[aria-pressed=true]{background:#244d43;color:#d9f4e9;border-color:#547c6d}
.dark .nf-workspace .nf-review-summary .nf-draft-note{background:#423925;color:#f4dbac}
.dark .nf-workspace .nf-preview-stage{background:#203849}
.dark .nf-workspace .nf-field input,.dark .nf-workspace .nf-field select,.dark .nf-workspace .nf-field textarea{border-color:#577181}
@media(max-width:1100px){.nf-review-layout{grid-template-columns:minmax(0,1fr)}.nf-review-summary{position:static;display:grid;grid-template-columns:1fr 1fr;gap:0 24px}.nf-review-summary>h2,.nf-review-summary>h3{grid-column:1/-1}.nf-review-downloads{margin-top:0}.nf-review-save{grid-column:1/-1}.nf-review-summary .nf-draft-note{margin:8px 0 0}.nf-preview-stage,.nf-preview-placeholder{min-height:540px}.nf-preview-stage iframe{height:640px}}
@media(max-width:760px){.nf.nf-workspace{padding-top:0;padding-bottom:28px}.nf-workspace-header{gap:12px;align-items:flex-start;padding:4px 0 16px}.nf-workspace h1{font-size:21px}.nf-document-meta{font-size:11px}.nf-workspace .nf-picker-toggle{font-size:12px;padding:8px 10px;min-height:38px}.nf-mode-bar{margin-bottom:16px;gap:4px}.nf-mode-bar button{padding:7px 8px;font-size:12px}.nf-editor{padding:16px;border-radius:12px}.nf-editor-overview{flex-direction:column;align-items:flex-start;gap:10px}.nf-progress-compact{font-size:11px}.nf-autofill-inline{gap:8px;align-items:flex-start;margin-top:10px}.nf-workspace .nf-toolbar{gap:4px;align-items:stretch}.nf-workspace .nf-filter{align-self:start;font-size:12px}.nf-section-toggle{gap:8px!important;padding:14px 12px!important;min-height:62px!important}.nf-section-title{font-size:13px}.nf-section-count{font-size:11px}.nf-section-body{padding:18px 12px 14px}.nf-workspace .nf-fields{grid-template-columns:1fr;gap:18px}.nf-workspace .nf-help-text{width:min(280px,70vw)}.nf-images-content>.nf-fields{grid-template-columns:1fr}.nf-edit-actions{bottom:76px;padding:12px;gap:12px;flex-wrap:wrap;border-radius:10px;margin-top:16px}.nf-draft-note{font-size:11px;max-width:none;flex:1}.nf-draft-note p{font-size:11px}.nf-action-buttons{gap:6px;margin-left:auto}.nf-action-buttons button{font-size:12px;padding:9px 12px}.nf-picker{padding:14px}.nf-picker-filters{grid-template-columns:1fr}.nf-picker .nf-list{grid-template-columns:1fr;max-height:260px}.nf-review-topbar{align-items:flex-start}.nf-review-summary{display:block;padding:16px}.nf-review-downloads{margin-top:14px;grid-template-columns:repeat(2,minmax(0,1fr))}.nf-review-downloads button{font-size:12px;padding:9px}.nf-review-downloads button:first-child:last-child{grid-column:1/-1}.nf-preview-stage,.nf-preview-placeholder{min-height:430px}.nf-preview-stage iframe{height:560px}.nf-preview-placeholder{padding:24px}.nf-review-layout{gap:16px}}
@media(prefers-reduced-motion:reduce){.nf-workspace *{scroll-behavior:auto!important;transition:none!important}}
.nf-search-result-caption{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;font-size:12px}.nf-search-result-caption button{font-size:12px}
@media(max-width:760px){.nf-review-summary{order:-1}.nf-section-pagination{gap:6px;font-size:11px}.nf-section-pagination button{font-size:11px;padding:8px}.nf-edit-actions .nf-draft-note{display:none}.nf-action-buttons{width:100%}.nf-action-buttons button{flex:1}.nf-editor-overview{flex-direction:row;align-items:center;gap:6px}.nf-editor-overview h2{font-size:17px}.nf-progress-compact{gap:6px}.nf-progress-compact progress{width:38px}.nf-search-result-caption{align-items:flex-start;flex-direction:column}}
`;
