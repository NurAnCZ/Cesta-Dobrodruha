import { NextResponse } from 'next/server';
import { verifyKey } from 'discord-interactions';

export async function POST(req: Request) {
  try {
    // Získáme hlavičky a čistý text zprávy pro ověření Discord podpisu
    const signature = req.headers.get('x-signature-ed25519');
    const timestamp = req.headers.get('x-signature-timestamp');
    const rawBody = await req.text(); 
    
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    // --- 1. JE TO PŘÍKAZ Z DISCORDU? ---
    if (signature && timestamp && publicKey) {
      // Šifrovací ověření
      const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);
      if (!isValidRequest) {
        return new NextResponse('Neplatný podpis', { status: 401 });
      }

      const body = JSON.parse(rawBody);

      // Discord zkouší Ping test
      if (body.type === 1) {
        return NextResponse.json({ type: 1 });
      }

      // Uživatel zadal příkaz /kral_mluv
    if (body.type === 2 && body.data?.name === 'kral_mluv') {
        let textOdUzivatele = body.data.options?.[0]?.value || '';
        
        // TADY SE DĚJE TO KOUZLO: Všechny // se změní na nový řádek
        const formatovanyText = textOdUzivatele.split('//').join('\n');

        return NextResponse.json({
          type: 4, 
          data: {
            embeds: [{
              title: '👑 Král Želvák promlouvá:',
              description: formatovanyText, // Tady použijeme ten upravený text
              color: 0xf1c40f 
            }]
          }
        });
      }
    // --- 2. JE TO ZÁPIS XP Z NAŠEHO WEBU? ---
    const body = JSON.parse(rawBody);
    const { characterName, xp, loot, dm, level, oldLevel, sessionTitle, sessionDate } = body;

    const token = process.env.DISCORD_BOT_TOKEN;
    const forumId = process.env.DISCORD_FORUM_CHANNEL_ID;

    if (!token || !forumId) {
      return NextResponse.json({ error: 'Chybí Discord token', success: false }, { status: 500 });
    }

    const headers = { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' };

    let formattedDate = sessionDate;
    if (sessionDate && sessionDate.includes('-')) {
      const [year, month, day] = sessionDate.split('-');
      formattedDate = `${parseInt(day)}.${parseInt(month)}.${year}`;
    }

    const channelRes = await fetch(`https://discord.com/api/v10/channels/${forumId}`, { headers });
    if (!channelRes.ok) return NextResponse.json({ error: 'Fórum nenalezeno', success: false }, { status: 404 });
    const channelData = await channelRes.json();
    const guildId = channelData.guild_id;

    const activeRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/threads/active`, { headers });
    const activeData = await activeRes.json();
    let thread = activeData.threads?.find((t: any) => t.parent_id === forumId && t.name.toLowerCase() === characterName.toLowerCase());

    if (!thread) {
      const archivedRes = await fetch(`https://discord.com/api/v10/channels/${forumId}/threads/archived/public`, { headers });
      const archivedData = await archivedRes.json();
      thread = archivedData.threads?.find((t: any) => t.name.toLowerCase() === characterName.toLowerCase());
    }

    if (!thread) {
      return NextResponse.json({ error: `Vlákno pro "${characterName}" nenalezeno.`, success: false }, { status: 404 });
    }

    const isLevelUp = Number(level) > Number(oldLevel);
    const messagePayload = {
      embeds: [{
        title: `📜 Nový záznam z výpravy: ${sessionTitle} (${formattedDate})`,
        color: isLevelUp ? 0xe74c3c : 0x3498db, 
        fields: [
          { name: 'Vypravěč', value: dm, inline: true },
          { name: 'Zkušenosti', value: `+${xp} XP`, inline: true },
          { name: 'Postava', value: characterName, inline: true },
          { name: isLevelUp ? '🎉 Nová úroveň!' : 'Úroveň', value: isLevelUp ? `**Lvl ${level}** (Postup!)` : `Lvl ${level}`, inline: true },
          ...(loot ? [{ name: 'Odměna / Kořist', value: loot }] : [])
        ]
      }]
    };

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
      method: 'POST', headers, body: JSON.stringify(messagePayload)
    });

    if (!msgRes.ok) throw new Error('Nepodařilo se odeslat na Discord');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Discord Bot Error:", error);
    return NextResponse.json({ error: 'Interní chyba API bota', success: false }, { status: 500 });
  }
}
