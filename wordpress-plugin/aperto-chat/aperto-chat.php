<?php
/**
 * Plugin Name:       Aperto – Assistente per il sito
 * Description:       Aggiunge l'assistente Aperto a tutte le pagine del sito. Basta incollare il codice dell'assistente.
 * Version:           0.1.0
 * Requires at least: 5.0
 * Requires PHP:      7.2
 * Author:            CORE829 S.r.l.
 * License:           GPL-2.0-or-later
 * Text Domain:       aperto-chat
 */

if (!defined('ABSPATH')) {
    exit;
}

define('APERTO_CHAT_OPTION', 'aperto_chat_settings');
// Indirizzo del servizio: in produzione il dominio definitivo di Aperto.
if (!defined('APERTO_CHAT_BASE_URL')) {
    define('APERTO_CHAT_BASE_URL', '{{BASE_URL}}');
}

function aperto_chat_get_settings() {
    $defaults = array('widget_id' => '', 'enabled' => '1');
    return wp_parse_args(get_option(APERTO_CHAT_OPTION, array()), $defaults);
}

/** Inserisce lo script del widget prima di </body>. */
function aperto_chat_print_script() {
    if (is_admin()) {
        return;
    }
    $s = aperto_chat_get_settings();
    if ($s['enabled'] !== '1' || !preg_match('/^wdg_[a-z0-9]{6,32}$/', $s['widget_id'])) {
        return;
    }
    printf(
        "<script src=\"%s\" data-id=\"%s\" async></script>\n",
        esc_url(trailingslashit(APERTO_CHAT_BASE_URL) . 'w.js'),
        esc_attr($s['widget_id'])
    );
}
add_action('wp_footer', 'aperto_chat_print_script', 100);

/** Pagina Impostazioni → Aperto. */
function aperto_chat_admin_menu() {
    add_options_page('Aperto', 'Aperto', 'manage_options', 'aperto-chat', 'aperto_chat_settings_page');
}
add_action('admin_menu', 'aperto_chat_admin_menu');

function aperto_chat_register_settings() {
    register_setting('aperto_chat', APERTO_CHAT_OPTION, array(
        'type' => 'array',
        'sanitize_callback' => 'aperto_chat_sanitize',
    ));
}
add_action('admin_init', 'aperto_chat_register_settings');

function aperto_chat_sanitize($input) {
    $id = isset($input['widget_id']) ? strtolower(trim(wp_unslash($input['widget_id']))) : '';
    // Accetta anche l'intera riga di codice copiata dalla dashboard.
    if (preg_match('/wdg_[a-z0-9]{6,32}/', $id, $m)) {
        $id = $m[0];
    } else {
        if ($id !== '') {
            add_settings_error(APERTO_CHAT_OPTION, 'invalid', 'Codice assistente non valido: deve iniziare con wdg_.');
        }
        $id = '';
    }
    return array(
        'widget_id' => $id,
        'enabled' => !empty($input['enabled']) ? '1' : '0',
    );
}

function aperto_chat_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $s = aperto_chat_get_settings();
    ?>
    <div class="wrap">
        <h1>Aperto – Assistente per il sito</h1>
        <p>Incolla il codice del tuo assistente. Lo trovi nella dashboard di Aperto, sezione <strong>Installazione</strong>.</p>
        <form method="post" action="options.php">
            <?php settings_fields('aperto_chat'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="aperto-widget-id">Codice assistente</label></th>
                    <td>
                        <input name="<?php echo esc_attr(APERTO_CHAT_OPTION); ?>[widget_id]" id="aperto-widget-id" type="text"
                               class="regular-text code" value="<?php echo esc_attr($s['widget_id']); ?>" placeholder="wdg_xxxxxxxxxxxx">
                        <p class="description">Puoi incollare anche l'intera riga di codice: il plugin estrae il codice da solo.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Stato</th>
                    <td>
                        <label><input name="<?php echo esc_attr(APERTO_CHAT_OPTION); ?>[enabled]" type="checkbox" value="1" <?php checked($s['enabled'], '1'); ?>>
                            Mostra l'assistente sul sito</label>
                    </td>
                </tr>
            </table>
            <?php submit_button('Salva'); ?>
        </form>
    </div>
    <?php
}

/** Link rapido alle impostazioni dalla lista dei plugin. */
function aperto_chat_action_links($links) {
    array_unshift($links, '<a href="' . esc_url(admin_url('options-general.php?page=aperto-chat')) . '">Impostazioni</a>');
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'aperto_chat_action_links');

register_uninstall_hook(__FILE__, 'aperto_chat_uninstall');
function aperto_chat_uninstall() {
    delete_option(APERTO_CHAT_OPTION);
}
