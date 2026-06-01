import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { characterName, xp, loot, dm, level } = body;

    const token = process.env.DISCORD_BOT_TOKEN;
    const forumId = process.env.DISCORD_FORUM_CHANNEL_ID;

    if (!token || !forumId) {
      return NextResponse.json(
        { error: 'Chybí Discord token nebo ID kanálu', success: false },
        { status: 500 }
      );
    }

    const headers = {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    };

    // 1. Zjistíme ID celého serveru (Guild ID) z našeho fóra
    const channelRes = await fetch(
      `https://discord.com/api/v10/channels/${forumId}`,
      { headers }
    );
    if (!channelRes.ok)
      return NextResponse.json(
        { error: 'Fórum nenalezeno, zkontrolujte ID', success: false },
        { status: 404 }
      );
    const channelData = await channelRes.json();
    const guildId = channelData.guild_id;

    // 2. Vyžádáme si aktivní vlákna z celého serveru
    const activeRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/threads/active`,
      { headers }
    );
    const activeData = await activeRes.json();

    // Zkusíme najít vlákno podle jména (ignorujeme velká/malá písmena) a ověříme, že patří do fóra
    let thread = activeData.threads?.find(
      (t: any) =>
        t.parent_id === forumId &&
        t.name.toLowerCase() === characterName.toLowerCase()
    );

    // 3. Pokud vlákno spí (je archivované), prohledáme archivovaná vlákna
    if (!thread) {
      const archivedRes = await fetch(
        `https://discord.com/api/v10/channels/${forumId}/threads/archived/public`,
        { headers }
      );
      const archivedData = await archivedRes.json();
      thread = archivedData.threads?.find(
        (t: any) => t.name.toLowerCase() === characterName.toLowerCase()
      );
    }

    if (!thread) {
      return NextResponse.json(
        { error: `Discord vlákno nebylo nalezeno.`, success: false },
        { status: 404 }
      );
    }

    // 4. Sestavení zprávy
    const messagePayload = {
      embeds: [
        {
          title: `📜 Nový záznam z výpravy`,
          color: 0x3498db,
          fields: [
            { name: 'Vypravěč', value: dm, inline: true },
            { name: 'Zkušenosti', value: `+${xp} XP`, inline: true },
            { name: 'Nová úroveň', value: `Lvl ${level}`, inline: true },
            ...(loot ? [{ name: 'Odměna / Kořist', value: loot }] : []),
          ],
        },
      ],
    };

    // 5. Odeslání zprávy do Discord vlákna
    const msgRes = await fetch(
      `https://discord.com/api/v10/channels/${thread.id}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(messagePayload),
      }
    );

    if (!msgRes.ok) throw new Error('Nepodařilo se odeslat zprávu do Discordu');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Discord Bot Error:', error);
    return NextResponse.json(
      { error: 'Interní chyba API bota', success: false },
      { status: 500 }
    );
  }
}

