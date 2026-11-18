<?php
/**
 * Plugin Name:       Sportello – Assistente per il sito
 * Description:       Aggiunge l'assistente Sportello a tutte le pagine del sito. Basta incollare il codice dell'assistente.
 * Version:           0.1.0
 * Requires at least: 5.0
 * Requires PHP:      7.2
 * Author:            CORE829 S.r.l.
 * License:           GPL-2.0-or-later
 * Text Domain:       sportello-chat
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SPORTELLO_CHAT_OPTION', 'sportello_chat_settings');
// Indirizzo del servizio: in produzione il dominio definitivo di Sportello.
if (!defined('SPORTELLO_CHAT_BASE_URL')) {
    define('SPORTELLO_CHAT_BASE_URL', '{{BASE_URL}}');
}

function sportello_chat_get_settings() {
    $defaults = array('widget_id' => '', 'enabled' => '1');
    return wp_parse_args(get_option(SPORTELLO_CHAT_OPTION, array()), $defaults);
}

/** Inserisce lo script del widget prima di </body>. */
function sportello_chat_print_script() {
    if (is_admin()) {
        return;
    }
    $s = sportello_chat_get_settings();
    if ($s['enabled'] !== '1' || !preg_match('/^wdg_[a-z0-9]{6,32}$/', $s['widget_id'])) {
        return;
    }
    printf(
        "<script src=\"%s\" data-id=\"%s\" async></script>\n",
        esc_url(trailingslashit(SPORTELLO_CHAT_BASE_URL) . 'w.js'),
        esc_attr($s['widget_id'])
    );
}
add_action('wp_footer', 'sportello_chat_print_script', 100);

/** Pagina Impostazioni → Sportello. */
function sportello_chat_admin_menu() {
    add_options_page('Sportello', 'Sportello', 'manage_options', 'sportello-chat', 'sportello_chat_settings_page');
}
add_action('admin_menu', 'sportello_chat_admin_menu');

function sportello_chat_register_settings() {
    register_setting('sportello_chat', SPORTELLO_CHAT_OPTION, array(
        'type' => 'array',
        'sanitize_callback' => 'sportello_chat_sanitize',
    ));
}
add_action('admin_init', 'sportello_chat_register_settings');

function sportello_chat_sanitize($input) {
    $id = isset($input['widget_id']) ? strtolower(trim(wp_unslash($input['widget_id']))) : '';
    // Accetta anche l'intera riga di codice copiata dalla dashboard.
    if (preg_match('/wdg_[a-z0-9]{6,32}/', $id, $m)) {
        $id = $m[0];
    } else {
        if ($id !== '') {
            add_settings_error(SPORTELLO_CHAT_OPTION, 'invalid', 'Codice assistente non valido: deve iniziare con wdg_.');
        }
        $id = '';
    }
    return array(
        'widget_id' => $id,
        'enabled' => !empty($input['enabled']) ? '1' : '0',
    );
}

function sportello_chat_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $s = sportello_chat_get_settings();
    ?>
    <div class="wrap">
        <h1>Sportello – Assistente per il sito</h1>
        <p>Incolla il codice del tuo assistente. Lo trovi nella dashboard di Sportello, sezione <strong>Installazione</strong>.</p>
        <form method="post" action="options.php">
            <?php settings_fields('sportello_chat'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="sportello-widget-id">Codice assistente</label></th>
                    <td>
                        <input name="<?php echo esc_attr(SPORTELLO_CHAT_OPTION); ?>[widget_id]" id="sportello-widget-id" type="text"
                               class="regular-text code" value="<?php echo esc_attr($s['widget_id']); ?>" placeholder="wdg_xxxxxxxxxxxx">
                        <p class="description">Puoi incollare anche l'intera riga di codice: il plugin estrae il codice da solo.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Stato</th>
                    <td>
                        <label><input name="<?php echo esc_attr(SPORTELLO_CHAT_OPTION); ?>[enabled]" type="checkbox" value="1" <?php checked($s['enabled'], '1'); ?>>
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
function sportello_chat_action_links($links) {
    array_unshift($links, '<a href="' . esc_url(admin_url('options-general.php?page=sportello-chat')) . '">Impostazioni</a>');
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'sportello_chat_action_links');

register_uninstall_hook(__FILE__, 'sportello_chat_uninstall');
function sportello_chat_uninstall() {
    delete_option(SPORTELLO_CHAT_OPTION);
}
