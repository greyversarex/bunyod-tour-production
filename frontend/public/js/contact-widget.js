/**
 * Floating Contact Widget with AI Chatbot
 * Плавающая кнопка связи с пульсацией и AI чат-ботом
 */

class ContactWidget {
    constructor() {
        this.isOpen = false;
        this.isChatOpen = false;
        this.init();
    }

    init() {
        this.injectStyles();
        this.createWidget();
        this.attachEventListeners();
        this.setupStickyBarAwareness();
    }

    injectStyles() {
        if (document.getElementById('contact-widget-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'contact-widget-styles';
        styles.textContent = `
            @keyframes pulse-ring {
                0% { transform: scale(0.8); opacity: 1; }
                100% { transform: scale(1.8); opacity: 0; }
            }
            @keyframes pulse-dot {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
            }
            @keyframes glow {
                0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.4), 0 4px 20px rgba(99, 102, 241, 0.3); }
                50% { box-shadow: 0 0 35px rgba(99, 102, 241, 0.6), 0 4px 30px rgba(99, 102, 241, 0.5); }
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes typingBounce {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-8px); }
            }
            .contact-widget {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 9999;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .contact-widget-main-btn {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                animation: float 3s ease-in-out infinite, glow 2s ease-in-out infinite;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .contact-widget-main-btn::before {
                content: '';
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: inherit;
                animation: pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
                z-index: -1;
            }
            .contact-widget-main-btn:hover {
                transform: scale(1.1);
                animation: glow 1s ease-in-out infinite;
            }
            .contact-widget-main-btn.open {
                animation: none;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            }
            .contact-widget-main-btn.open::before {
                animation: none;
                opacity: 0;
            }
            .contact-widget-main-btn .icon-container {
                width: 32px;
                height: 32px;
                position: relative;
            }
            .contact-widget-main-btn .chat-icon,
            .contact-widget-main-btn .close-icon {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                fill: white;
                transition: all 0.3s ease;
            }
            .contact-widget-main-btn .close-icon {
                opacity: 0;
                transform: rotate(-90deg) scale(0.5);
            }
            .contact-widget-main-btn.open .chat-icon {
                opacity: 0;
                transform: rotate(90deg) scale(0.5);
            }
            .contact-widget-main-btn.open .close-icon {
                opacity: 1;
                transform: rotate(0) scale(1);
            }
            .contact-widget-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                width: 22px;
                height: 22px;
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
                color: white;
                box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
                animation: pulse-dot 1.5s ease-in-out infinite;
            }
            .contact-widget-menu {
                position: absolute;
                bottom: 80px;
                right: 0;
                display: flex;
                flex-direction: column;
                gap: 14px;
                opacity: 0;
                visibility: hidden;
                transform: translateY(20px) scale(0.9);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .contact-widget.open .contact-widget-menu {
                opacity: 1;
                visibility: visible;
                transform: translateY(0) scale(1);
            }
            .contact-widget-item {
                display: flex;
                align-items: center;
                gap: 12px;
                text-decoration: none;
                position: relative;
            }
            .contact-widget-item-btn {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                flex-shrink: 0;
                position: relative;
                overflow: hidden;
            }
            .contact-widget-item-btn::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: width 0.4s, height 0.4s;
            }
            .contact-widget-item-btn:hover::before {
                width: 120%;
                height: 120%;
            }
            .contact-widget-item-btn:hover {
                transform: scale(1.1);
            }
            .contact-widget-item-btn.whatsapp {
                background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            }
            .contact-widget-item-btn.telegram {
                background: linear-gradient(135deg, #0088cc 0%, #0077b5 100%);
            }
            .contact-widget-item-btn.chatbot {
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            }
            .contact-widget-item-btn svg {
                width: 26px;
                height: 26px;
                fill: white;
                position: relative;
                z-index: 1;
            }
            .contact-widget-tooltip {
                position: absolute;
                right: 65px;
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 500;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transform: translateX(10px);
                transition: all 0.2s ease;
                pointer-events: none;
            }
            .contact-widget-tooltip::after {
                content: '';
                position: absolute;
                right: -6px;
                top: 50%;
                transform: translateY(-50%);
                border: 6px solid transparent;
                border-left-color: rgba(0, 0, 0, 0.85);
            }
            .contact-widget-item:hover .contact-widget-tooltip {
                opacity: 1;
                visibility: visible;
                transform: translateX(0);
            }
            .contact-widget-submenu {
                position: absolute;
                right: 60px;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 16px;
                padding: 12px;
                min-width: 220px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.1);
                opacity: 0;
                visibility: hidden;
                transform: translateY(-50%) translateX(10px) scale(0.95);
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .whatsapp-parent:hover .contact-widget-submenu {
                opacity: 1;
                visibility: visible;
                transform: translateY(-50%) translateX(0) scale(1);
            }
            .contact-widget-submenu-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 14px;
                border-radius: 12px;
                text-decoration: none;
                color: #374151;
                transition: all 0.2s ease;
                cursor: pointer;
            }
            .contact-widget-submenu-item:hover {
                background: linear-gradient(135deg, rgba(37, 211, 102, 0.1) 0%, rgba(18, 140, 126, 0.1) 100%);
            }
            .contact-widget-submenu-item svg {
                width: 24px;
                height: 24px;
                fill: #25D366;
                flex-shrink: 0;
            }
            .contact-widget-submenu-item .phone-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .contact-widget-submenu-item .phone-number {
                font-weight: 600;
                font-size: 14px;
                color: #111827;
            }
            .contact-widget-submenu-item .phone-msg {
                font-size: 11px;
                color: #6b7280;
                font-style: italic;
            }
            .chatbot-window {
                position: fixed;
                bottom: 100px;
                right: 24px;
                width: 380px;
                height: 520px;
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                display: none;
                flex-direction: column;
                overflow: hidden;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            }
            .chatbot-window.open {
                display: flex;
            }
            .chatbot-header {
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                color: white;
                padding: 18px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .chatbot-header-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .chatbot-avatar {
                width: 42px;
                height: 42px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .chatbot-avatar svg {
                width: 24px;
                height: 24px;
                fill: white;
            }
            .chatbot-title {
                font-weight: 600;
                font-size: 16px;
            }
            .chatbot-status {
                font-size: 12px;
                opacity: 0.9;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .chatbot-status::before {
                content: '';
                width: 8px;
                height: 8px;
                background: #22c55e;
                border-radius: 50%;
                animation: pulse-dot 1.5s ease infinite;
            }
            .chatbot-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            .chatbot-close:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }
            .chatbot-close svg {
                width: 18px;
                height: 18px;
                fill: white;
            }
            .chatbot-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                background: #f9fafb;
            }
            .chat-message {
                max-width: 85%;
                padding: 14px 18px;
                border-radius: 18px;
                font-size: 14px;
                line-height: 1.5;
                animation: fadeIn 0.3s ease;
            }
            .chat-message.bot {
                background: white;
                color: #374151;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
            }
            .chat-message.user {
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                color: white;
                align-self: flex-end;
                border-bottom-right-radius: 4px;
            }
            .chat-message.typing {
                display: flex;
                gap: 4px;
                padding: 16px 20px;
            }
            .typing-dot {
                width: 8px;
                height: 8px;
                background: #9ca3af;
                border-radius: 50%;
                animation: typingBounce 1.4s ease-in-out infinite;
            }
            .typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-dot:nth-child(3) { animation-delay: 0.4s; }
            .chatbot-input-area {
                padding: 16px 20px;
                background: white;
                border-top: 1px solid #e5e7eb;
                display: flex;
                gap: 12px;
            }
            .chatbot-input {
                flex: 1;
                border: 2px solid #e5e7eb;
                border-radius: 25px;
                padding: 12px 20px;
                font-size: 14px;
                outline: none;
                transition: all 0.2s ease;
            }
            .chatbot-input:focus {
                border-color: #6366f1;
                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
            }
            .chatbot-send {
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                border: none;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            .chatbot-send:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
            }
            .chatbot-send:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .chatbot-send svg {
                width: 20px;
                height: 20px;
                fill: white;
            }
            @media (max-width: 640px) {
                .contact-widget {
                    bottom: 16px;
                    right: 16px;
                }
                .contact-widget-main-btn {
                    width: 58px;
                    height: 58px;
                }
                .contact-widget-item-btn {
                    width: 48px;
                    height: 48px;
                }
                .contact-widget-tooltip {
                    display: none;
                }
                .contact-widget-submenu {
                    right: 58px;
                    min-width: 190px;
                }
                .chatbot-window {
                    width: calc(100vw - 32px);
                    height: 70vh;
                    right: 16px;
                    bottom: 90px;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    createWidget() {
        if (document.getElementById('contact-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'contact-widget';
        widget.className = 'contact-widget';
        widget.innerHTML = `
            <div class="contact-widget-menu">
                <div class="contact-widget-item whatsapp-parent">
                    <button class="contact-widget-item-btn whatsapp" aria-label="WhatsApp">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                    </button>
                    <span class="contact-widget-tooltip">WhatsApp</span>
                    <div class="contact-widget-submenu">
                        <a href="https://api.whatsapp.com/send/?phone=992915123344&text=I+am+happy+to+guide+you%21&type=phone_number&app_absent=0" 
                           target="_blank" rel="noopener noreferrer" class="contact-widget-submenu-item">
                            <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            <div class="phone-info">
                                <span class="phone-number">Hikmatullo</span>
                                <span class="phone-msg">I am happy to guide you!</span>
                            </div>
                        </a>
                        <a href="https://api.whatsapp.com/send/?phone=992882353434&text=I+hope+you+will+be+with+us%21&type=phone_number&app_absent=0" 
                           target="_blank" rel="noopener noreferrer" class="contact-widget-submenu-item">
                            <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            <div class="phone-info">
                                <span class="phone-number">Oyatullo</span>
                                <span class="phone-msg">I hope you will be with us!</span>
                            </div>
                        </a>
                        <a href="https://api.whatsapp.com/send/?phone=992550670660&text=Please%2C+may+I+help+you%3F&type=phone_number&app_absent=0" 
                           target="_blank" rel="noopener noreferrer" class="contact-widget-submenu-item">
                            <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            <div class="phone-info">
                                <span class="phone-number">Sitoramo</span>
                                <span class="phone-msg">Please, may I help you?</span>
                            </div>
                        </a>
                    </div>
                </div>
                <a href="https://telegram.me/bunyodtour2021" target="_blank" rel="noopener noreferrer" class="contact-widget-item">
                    <button class="contact-widget-item-btn telegram" aria-label="Telegram">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                        </svg>
                    </button>
                    <span class="contact-widget-tooltip">Telegram</span>
                </a>
                <div class="contact-widget-item" id="chatbot-trigger">
                    <button class="contact-widget-item-btn chatbot" aria-label="AI Assistant">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <ellipse cx="12" cy="9" rx="8" ry="7" fill="#e0e5ec"/>
                            <ellipse cx="12" cy="9" rx="6" ry="5" fill="#2d3748"/>
                            <ellipse cx="9" cy="8.5" rx="1.8" ry="2.2" fill="#22d3ee"/>
                            <ellipse cx="15" cy="8.5" rx="1.8" ry="2.2" fill="#22d3ee"/>
                            <path d="M9 12 Q12 14 15 12" stroke="#22d3ee" stroke-width="1.2" fill="none" stroke-linecap="round"/>
                            <ellipse cx="3" cy="10" rx="1.5" ry="2" fill="#e0e5ec"/>
                            <ellipse cx="21" cy="10" rx="1.5" ry="2" fill="#e0e5ec"/>
                            <ellipse cx="12" cy="19" rx="4" ry="5" fill="#e0e5ec"/>
                            <ellipse cx="12" cy="15" rx="3" ry="1" fill="#22d3ee"/>
                        </svg>
                    </button>
                    <span class="contact-widget-tooltip">AI Assistant</span>
                </div>
            </div>
            <button class="contact-widget-main-btn" id="contact-widget-toggle" aria-label="Contact us">
                <div class="icon-container">
                    <svg class="chat-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                        <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
                    </svg>
                    <svg class="close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </div>
                <span class="contact-widget-badge">3</span>
            </button>
            <div class="chatbot-window" id="chatbot-window">
                <div class="chatbot-header">
                    <div class="chatbot-header-info">
                        <div class="chatbot-avatar">
                            <svg viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="8" ry="7" fill="#e0e5ec"/><ellipse cx="12" cy="9" rx="6" ry="5" fill="#2d3748"/><ellipse cx="9" cy="8.5" rx="1.8" ry="2.2" fill="#22d3ee"/><ellipse cx="15" cy="8.5" rx="1.8" ry="2.2" fill="#22d3ee"/><path d="M9 12 Q12 14 15 12" stroke="#22d3ee" stroke-width="1.2" fill="none" stroke-linecap="round"/><ellipse cx="3" cy="10" rx="1.5" ry="2" fill="#e0e5ec"/><ellipse cx="21" cy="10" rx="1.5" ry="2" fill="#e0e5ec"/><ellipse cx="12" cy="19" rx="4" ry="5" fill="#e0e5ec"/><ellipse cx="12" cy="15" rx="3" ry="1" fill="#22d3ee"/></svg>
                        </div>
                        <div>
                            <div class="chatbot-title">Bunyod-Tour AI</div>
                            <div class="chatbot-status">Online</div>
                        </div>
                    </div>
                    <button class="chatbot-close" id="chatbot-close">
                        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
                <div class="chatbot-messages" id="chatbot-messages"></div>
                <div class="chatbot-input-area">
                    <input type="text" class="chatbot-input" id="chatbot-input" placeholder="Type your message..." />
                    <button class="chatbot-send" id="chatbot-send">
                        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(widget);
        this.addWelcomeMessage();
    }

    addWelcomeMessage() {
        const messagesContainer = document.getElementById('chatbot-messages');
        if (!messagesContainer) return;
        
        const lang = window.currentLanguage || 'en';
        const welcomeText = lang === 'en' 
            ? 'Hello! I am the Bunyod-Tour AI assistant. I can help with information about tours, hotels, guides, and services in Central Asia. How can I help you?'
            : 'Привет! Я AI-помощник Bunyod-Tour. Могу помочь с информацией о турах, отелях, гидах и услугах в Центральной Азии. Чем могу помочь?';
        
        const botMsg = document.createElement('div');
        botMsg.className = 'chat-message bot';
        botMsg.textContent = welcomeText;
        messagesContainer.appendChild(botMsg);
    }

    setupStickyBarAwareness() {
        const updateWidgetPosition = () => {
            const widget = document.getElementById('contact-widget');
            if (!widget) return;
            const stickyBar = document.getElementById('stickyBookNowBar');
            if (stickyBar && stickyBar.classList.contains('visible')) {
                widget.style.bottom = '90px';
            } else {
                widget.style.bottom = '24px';
            }
        };

        window.addEventListener('scroll', updateWidgetPosition, { passive: true });

        const stickyBar = document.getElementById('stickyBookNowBar');
        if (stickyBar) {
            const observer = new MutationObserver(updateWidgetPosition);
            observer.observe(stickyBar, { attributes: true, attributeFilter: ['class'] });
        } else {
            const waitForStickyBar = setInterval(() => {
                const bar = document.getElementById('stickyBookNowBar');
                if (bar) {
                    clearInterval(waitForStickyBar);
                    const observer = new MutationObserver(updateWidgetPosition);
                    observer.observe(bar, { attributes: true, attributeFilter: ['class'] });
                    updateWidgetPosition();
                }
            }, 300);
            setTimeout(() => clearInterval(waitForStickyBar), 10000);
        }

        updateWidgetPosition();
    }

    attachEventListeners() {
        const toggle = document.getElementById('contact-widget-toggle');
        const widget = document.getElementById('contact-widget');
        const chatbotTrigger = document.getElementById('chatbot-trigger');
        const chatbotWindow = document.getElementById('chatbot-window');
        const chatbotClose = document.getElementById('chatbot-close');
        const chatbotInput = document.getElementById('chatbot-input');
        const chatbotSend = document.getElementById('chatbot-send');

        if (toggle && widget) {
            toggle.addEventListener('click', () => {
                this.isOpen = !this.isOpen;
                widget.classList.toggle('open', this.isOpen);
                toggle.classList.toggle('open', this.isOpen);
                
                if (!this.isOpen && chatbotWindow) {
                    chatbotWindow.classList.remove('open');
                    this.isChatOpen = false;
                }
            });

            document.addEventListener('click', (e) => {
                if (!widget.contains(e.target) && this.isOpen && !chatbotWindow?.contains(e.target)) {
                    this.isOpen = false;
                    widget.classList.remove('open');
                    toggle.classList.remove('open');
                }
            });
        }

        if (chatbotTrigger && chatbotWindow) {
            chatbotTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.isChatOpen = true;
                chatbotWindow.classList.add('open');
                if (chatbotInput) chatbotInput.focus();
            });
        }

        if (chatbotClose && chatbotWindow) {
            chatbotClose.addEventListener('click', () => {
                chatbotWindow.classList.remove('open');
                this.isChatOpen = false;
            });
        }

        if (chatbotSend && chatbotInput) {
            chatbotSend.addEventListener('click', () => this.sendMessage());
            chatbotInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
    }

    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        const messagesContainer = document.getElementById('chatbot-messages');
        const sendBtn = document.getElementById('chatbot-send');
        
        const message = input?.value.trim();
        if (!message) return;
        
        input.value = '';
        sendBtn.disabled = true;

        const userMsg = document.createElement('div');
        userMsg.className = 'chat-message user';
        userMsg.textContent = message;
        messagesContainer.appendChild(userMsg);

        const typingMsg = document.createElement('div');
        typingMsg.className = 'chat-message bot typing';
        typingMsg.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
        messagesContainer.appendChild(typingMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const response = await fetch('/api/chatbot/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, language: window.currentLanguage || 'en' })
            });

            const data = await response.json();
            typingMsg.remove();

            const botMsg = document.createElement('div');
            botMsg.className = 'chat-message bot';
            botMsg.textContent = data.reply || (window.currentLanguage === 'en' 
                ? 'Sorry, an error occurred. Please try again.' 
                : 'Извините, произошла ошибка. Попробуйте позже.');
            messagesContainer.appendChild(botMsg);
        } catch (error) {
            typingMsg.remove();
            const errorMsg = document.createElement('div');
            errorMsg.className = 'chat-message bot';
            errorMsg.textContent = window.currentLanguage === 'en'
                ? 'Sorry, connection failed. Please contact us via WhatsApp or Telegram.'
                : 'Извините, не удалось подключиться. Свяжитесь через WhatsApp или Telegram.';
            messagesContainer.appendChild(errorMsg);
        }

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        sendBtn.disabled = false;
    }
}

function initContactWidget() {
    if (document.getElementById('contact-widget')) {
        return;
    }
    
    if (document.body) {
        new ContactWidget();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactWidget);
} else {
    initContactWidget();
}

window.ContactWidget = ContactWidget;
window.initContactWidget = initContactWidget;
