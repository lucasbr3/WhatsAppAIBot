import logger from '../logger.js';
import { getMusicPlayer } from '../music/player.js';
import models from '../database/models.js';

export const processCommand = {
  async ping(sock, jid) {
    await sock.sendMessage(jid, { text: '🏓 Pong!' });
    return true;
  },

  async help(sock, jid) {
    const help = `🤖 *Comandos disponíveis:*

🎵 *Música:*
!play <nome> - Tocar música
!pause - Pausar
!resume - Continuar
!stop - Parar
!skip / !next - Próxima
!queue / !fila - Ver fila
!volume <0-100> - Volume

🤖 *IA:*
Envie qualquer mensagem para conversar com a IA

📞 *Chamadas:*
Ligue para o número para falar com a IA

📊 *Info:*
!ping - Testar conexão
!help - Esta mensagem
!status - Status do bot
!clear - Limpar histórico`;
    await sock.sendMessage(jid, { text: help });
    return true;
  },

  async status(sock, jid) {
    const users = models.getAllUsers().length;
    const queue = getMusicPlayer().getQueueList().length;
    const msg = `📊 *Status do Bot*

🤖 Conexão: 🟢 Online
👥 Usuários: ${users}
🎵 Fila: ${queue} músicas
⚡ Versão: 1.0.0`;
    await sock.sendMessage(jid, { text: msg });
    return true;
  },

  async clear(sock, jid) {
    const userId = jid.replace('@s.whatsapp.net', '');
    models.clearHistory(userId);
    await sock.sendMessage(jid, { text: '🗑️ Histórico limpo!' });
    return true;
  },
};
