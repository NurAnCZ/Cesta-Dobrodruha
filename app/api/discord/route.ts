// POMOCNÁ FUNKCE PRO REGISTRACI PŘÍKAZU - SPUSTÍ SE JEN JEDNOU
async function registerSlashCommand(token: string) {
  // Zde doplň ID své aplikace (najdeš v Discord Developer Portálu u bota jako Application ID)
  const clientId = "1510695743051141332"; 
  
  const commandData = {
    name: 'kral_mluv',
    description: 'Pošle zprávu jménem Krále Želváka (pouze pro DM/Adminy)',
    default_member_permissions: "8", // "8" je interní kód Discordu pro Administrátora. Nikdo jiný příkaz neuvidí!
    options: [
      {
        name: 'zprava',
        description: 'Text, který má Král Želvák říct',
        type: 3, // 3 znamená TEXT
        required: true
      }
    ]
  };

  await fetch(`https://discord.com/api/v10/applications/${clientId}/commands`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandData)
  });
}

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // --- CHYTRÉ ROZPOZNÁNÍ: JDE O PŘÍKAZ Z DISCORDU? ---
    if (body.type !== undefined) {
      // 1. Discord posílá PING na ověření spojení
      if (body.type === 1) {
        return NextResponse.json({ type: 1 });
      }

      // 2. Uživatel použil náš Slash příkaz /kral_mluv
      if (body.type === 2 && body.data?.name === 'kral_mluv') {
        const textOdUzivatele = body.data.options?.[0]?.value || '';

        // Odpovíme Discordu, že zprávu úspěšně posíláme dál
        return NextResponse.json({
          type: 4, // Typ 4 = Odpověď zprávou
          data: {
            content: textOdUzivatele // Bot prostě zopakuje text uživatele, ale pod svým jménem a avatarem Krále Želváka!
          }
        });
      }
    }

    // --- KLASICKÝ KÓD PRO ODESÍLÁNÍ XP Z WEBU ---
    const { characterName, xp, loot, dm, level, oldLevel, sessionTitle, sessionDate } = body;
    const token = process.env.DISCORD_BOT_TOKEN;
    const forumId = process.env.DISCORD_FORUM_CHANNEL_ID;

    if (!token || !forumId) {
      return NextResponse.json({ error: 'Chybí Discord token nebo ID kanálu', success: false }, { status: 500 });
    }

    const headers = {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    };

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
      return NextResponse.json({ error: `Vlákno pro postavu "${characterName}" nebylo nalezeno.`, success: false }, { status: 404 });
    }

    const isLevelUp = Number(level) > Number(oldLevel);
    const levelLabel = isLevelUp ? '🎉 Nová úroveň!' : 'Úroveň';
    const levelValue = isLevelUp ? `**Lvl ${level}** (Postup!)` : `Lvl ${level}`;

    const messagePayload = {
      embeds: [{
        title: `📜 Nový záznam z výpravy: ${sessionTitle} (${formattedDate})`,
        color: isLevelUp ? 0xe74c3c : 0x3498db, 
        fields: [
          { name: 'Vypravěč', value: dm, inline: true },
          { name: 'Zkušenosti', value: `+${xp} XP`, inline: true },
          { name: 'Postava', value: characterName, inline: true },
          { name: levelLabel, value: levelValue, inline: true },
          ...(loot ? [{ name: 'Odměna / Kořist', value: loot }] : [])
        ]
      }]
    };

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(messagePayload)
    });

    if (!msgRes.ok) throw new Error('Nepodařilo se odeslat zprávu do Discordu');

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Discord Bot Error:", error);
    return NextResponse.json({ error: 'Interní chyba API bota', success: false }, { status: 500 });
  }
}
