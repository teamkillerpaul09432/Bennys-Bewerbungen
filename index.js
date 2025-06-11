const {
    Client,
    GatewayIntentBits,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ChannelType,
    PermissionsBitField,
    SlashCommandBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const MITARBEITER_PATH = path.join(__dirname, 'mitarbeiter.json');

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot ist online als ${client.user.tag}`);

    try {
        const channel = await client.channels.fetch(process.env.BEWERBUNGS_CHANNEL);

        const button = new ButtonBuilder()
            .setCustomId('open_modal')
            .setLabel('Bewerbung einreichen')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const embed = new EmbedBuilder()
            .setTitle('Bewerbung bei Bennys')
            .setDescription('Willkommen im Bewerbungskanal von Bennys!\n\n📌 Klicke auf den Button unten, um deine Bewerbung einzureichen.')
            .setColor(0x5865f2);

        await channel.send({ embeds: [embed], components: [row] });
        console.log(`📨 Embed automatisch in Channel #${channel.name} gesendet`);
    } catch (err) {
        console.error('❌ Fehler beim Senden des Embeds:', err);
    }

    const data = [
        new SlashCommandBuilder()
            .setName('einstellen')
            .setDescription('Stellt einen neuen Mitarbeiter ein')
            .addStringOption(option => option.setName('name').setDescription('Name des Mitarbeiters').setRequired(true))
            .addIntegerOption(option => option.setName('dns').setDescription('Dienstnummer').setRequired(true))
            .addStringOption(option => option.setName('iban').setDescription('IBAN des Mitarbeiters').setRequired(true))
            .toJSON(),

        new SlashCommandBuilder()
            .setName('nächstefreiedns')
            .setDescription('Zeigt die nächste freie Dienstnummer an')
            .toJSON(),

        new SlashCommandBuilder()
            .setName('mitarbeiterliste')
            .setDescription('Zeigt die Liste aller Mitarbeiter')
            .toJSON(),

        new SlashCommandBuilder()
            .setName('kündigen')
            .setDescription('Mitarbeiter anhand der Dienstnummer kündigen')
            .addIntegerOption(option => option.setName('dns').setDescription('Dienstnummer').setRequired(true))
            .toJSON()
    ];

    await client.application.commands.set(data);
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton() && interaction.customId === 'open_modal') {
        const modal = new ModalBuilder()
            .setCustomId('bewerbung_modal')
            .setTitle('Bewerbung bei Bennys');

        const name = new TextInputBuilder().setCustomId('ic_name').setLabel('Name').setStyle(TextInputStyle.Short).setRequired(true);
        const alter = new TextInputBuilder().setCustomId('ic_alter').setLabel('Alter').setStyle(TextInputStyle.Short).setRequired(true);
        const handy = new TextInputBuilder().setCustomId('ic_handy').setLabel('Handynummer').setStyle(TextInputStyle.Short).setRequired(true);
        const iban = new TextInputBuilder().setCustomId('ic_IBAN').setLabel('IBAN').setStyle(TextInputStyle.Short).setRequired(true);
        const motivation = new TextInputBuilder().setCustomId('motivation').setLabel('Motivationsschreiben').setStyle(TextInputStyle.Paragraph).setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(name),
            new ActionRowBuilder().addComponents(alter),
            new ActionRowBuilder().addComponents(handy),
            new ActionRowBuilder().addComponents(iban),
            new ActionRowBuilder().addComponents(motivation)
        );

        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'bewerbung_modal') {
        const ic_name = interaction.fields.getTextInputValue('ic_name');
        const ic_alter = interaction.fields.getTextInputValue('ic_alter');
        const ic_handy = interaction.fields.getTextInputValue('ic_handy');
        const ic_iban = interaction.fields.getTextInputValue('ic_IBAN');
        const motivation = interaction.fields.getTextInputValue('motivation');

        const embed = new EmbedBuilder()
            .setTitle('📄 Neue Bewerbung beim Bennys')
            .addFields(
                { name: 'Name', value: ic_name },
                { name: 'Alter', value: ic_alter },
                { name: 'Handynummer', value: ic_handy },
                { name: 'IBAN', value: ic_iban },
                { name: 'Motivationsschreiben', value: motivation || 'Keine Angabe' }
            )
            .setColor(0x00ff99)
            .setTimestamp();

        const acceptButton = new ButtonBuilder().setCustomId('accept_application').setLabel('Bewerbung annehmen').setStyle(ButtonStyle.Success);
        const denyButton = new ButtonBuilder().setCustomId('deny_application').setLabel('Bewerbung ablehnen').setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(acceptButton, denyButton);

        try {
            const guild = interaction.guild;
            const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
            const channelName = `bewerbung-${username}`;

            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
                    { id: process.env.PERSO_ROLLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                ]
            });

            await channel.send({
                content: `<@${interaction.user.id}> hat eine Bewerbung eingereicht.`,
                embeds: [embed],
                components: [row]
            });

            // 📬 DM an alle mit PERSO_ROLLE schicken (mit Embed)
            const role = guild.roles.cache.get(process.env.PERSO_ROLLE);
            if (role) {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('📥 Neue Bewerbung eingegangen')
                    .setDescription(`Neue Bewerbung von **${ic_name}** wurde eingereicht.\n\nKlicke [Hier Um Die Bewerbung Zu Öffnen](https://discord.com/channels/${guild.id})`)
                    .setColor(0x00ff99)
                    .setTimestamp()
                    .setFooter({ text: `Bewerbung von ${ic_name}` });

                for (const member of role.members.values()) {
                    try {
                        await member.send({ embeds: [dmEmbed] });
                    } catch (err) {
                        console.warn(`⚠️ Konnte ${member.user.tag} keine DM senden.`);
                    }
                }
            }

            const infoEmbed = new EmbedBuilder()
                .setDescription('✅ Du hast deine Bewerbung erfolgreich eingereicht. Das Team wird sie bald prüfen.')
                .setColor(0x00ff99);

            await interaction.reply({ embeds: [infoEmbed], ephemeral: true });

        } catch (err) {
            console.error('❌ Fehler beim Erstellen des Bewerbungschannels:', err);
            await interaction.reply({ content: '❌ Fehler beim Einreichen der Bewerbung. Bitte versuche es später erneut.', ephemeral: true });
        }
    }

    if (interaction.isButton() && interaction.customId === 'accept_application') {
        const channel = interaction.channel;
        const messages = await channel.messages.fetch({ limit: 10 });
        const firstMention = messages.find(msg => msg.mentions.users.size > 0);
        const user = firstMention?.mentions.users.first();

        if (!user) return interaction.reply({ content: '⚠️ Kein Bewerber gefunden.', ephemeral: true });

        await channel.permissionOverwrites.edit(user.id, { SendMessages: true });
        await interaction.reply({ content: `✅ Schreibrechte für <@${user.id}> wurden aktiviert.` });
    }

    if (interaction.isButton() && interaction.customId === 'deny_application') {
        const channel = interaction.channel;
        const messages = await channel.messages.fetch({ limit: 10 });
        const firstMention = messages.find(msg => msg.mentions.users.size > 0);
        const user = firstMention?.mentions.users.first();

        if (!user) return interaction.reply({ content: '⚠️ Kein Bewerber gefunden.', ephemeral: true });

        const closeButton = new ButtonBuilder().setCustomId('close_ticket').setLabel('Sofort schließen').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(closeButton);

        await channel.send({ content: `<@${user.id}> Deine Bewerbung wurde leider abgelehnt.`, components: [row] });

        setTimeout(() => {
            channel.delete().catch(console.error);
        }, 24 * 60 * 60 * 1000);
    }

    if (interaction.isButton() && ['accept_application', 'deny_application'].includes(interaction.customId)) {
        const channel = interaction.channel;
        const messages = await channel.messages.fetch({ limit: 10 });
        const firstMention = messages.find(msg => msg.mentions.users.size > 0);
        const user = firstMention?.mentions.users.first();

        if (!user) return interaction.reply({ content: '⚠️ Kein Bewerber gefunden.', ephemeral: true });

        // Versuche DM zu senden
        try {
            if (interaction.customId === 'accept_application') {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('✅ Bewerbung angenommen')
                            .setDescription('Glückwunsch! Deine Bewerbung wurde angenommen.')
                            .setColor(0x00ff99)
                    ]
                });
            } else {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('❌ Bewerbung abgelehnt')
                            .setDescription('Deine Bewerbung wurde abgelehnt. Du kannst dich später erneut bewerben.')
                            .setColor(0xff0000)
                    ]
                });
            }
        } catch (err) {
            console.warn(`❌ Konnte DM an ${user.tag} nicht senden. Vermutlich deaktiviert.`);
        }

        // Bewerbungsnachricht löschen
        if (messages.first()) {
            try {
                await messages.first().delete();
            } catch (err) {
                console.error('❌ Fehler beim Löschen der Bewerbungsnachricht:', err);
            }
        }

        if (interaction.customId === 'accept_application') {
            await channel.permissionOverwrites.edit(user.id, { SendMessages: true });
            await interaction.reply({
                embeds: [new EmbedBuilder().setDescription(`✅ Schreibrechte für <@${user.id}> wurden aktiviert.`).setColor(0x00ff99)]
            });
        } else {
            const closeButton = new ButtonBuilder().setCustomId('close_ticket').setLabel('Sofort schließen').setStyle(ButtonStyle.Secondary);
            const row = new ActionRowBuilder().addComponents(closeButton);

            await channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Bewerbung abgelehnt')
                        .setDescription(`<@${user.id}> Deine Bewerbung wurde abgelehnt.`)
                        .setColor(0xff0000)
                ],
                components: [row]
            });

            await interaction.reply({ ephemeral: true, content: '🚫 Bewerbung wurde abgelehnt.' });

            setTimeout(() => {
                channel.delete().catch(console.error);
            }, 24 * 60 * 60 * 1000);
        }
    }
    
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const userId = interaction.user.id;
        const channel = interaction.channel;

        const overwrites = channel.permissionOverwrites.cache.get(userId);
        if (!overwrites || !overwrites.allow.has(PermissionsBitField.Flags.ViewChannel)) {
            return interaction.reply({ content: '❌ Nur der Ticket-Ersteller kann diesen Button verwenden.', ephemeral: true });
        }

        await interaction.reply({ content: '🛑 Ticket wird geschlossen...' });
        await channel.delete();
    }

    if (interaction.isChatInputCommand()) {
        const persoRoleId = process.env.PERSO_ROLLE;
        const memberRoles = interaction.member.roles;

        if (interaction.commandName === 'mitarbeiterliste') {
            let mitarbeiter = [];
            if (fs.existsSync(MITARBEITER_PATH)) {
                mitarbeiter = JSON.parse(fs.readFileSync(MITARBEITER_PATH));
            }

            if (mitarbeiter.length === 0) {
                return interaction.reply({ content: '⚠️ Es sind keine Mitarbeiter eingetragen.', ephemeral: true });
            }

            const header = `\`\`\`DNS    | Name                 | IBAN\n` +
                           `---------------------------------------------\n`;
            const rows = mitarbeiter.map(m => {
                const dns = m.dns.toString().padEnd(6, ' ');
                const name = m.name.padEnd(20, ' ');
                const iban = (m.iban || 'Nicht angegeben');
                return `${dns}| ${name}| ${iban}`;
            }).join('\n');
            const footer = `\`\`\``;

            const embed = new EmbedBuilder()
                .setTitle('📋 Mitarbeiterliste')
                .setDescription(header + rows + footer)
                .setColor(0x00ff99)
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!memberRoles.cache.has(persoRoleId)) {
            return interaction.reply({ content: '❌ Du hast keine Berechtigung für diesen Befehl.', ephemeral: true });
        }

        if (interaction.commandName === 'einstellen') {
            const name = interaction.options.getString('name');
            const dns = interaction.options.getInteger('dns');
            const iban = interaction.options.getString('iban');

            let mitarbeiter = [];
            if (fs.existsSync(MITARBEITER_PATH)) {
                mitarbeiter = JSON.parse(fs.readFileSync(MITARBEITER_PATH));
            }

            if (mitarbeiter.some(m => m.dns === dns)) {
                return interaction.reply({ content: `❌ Die DNS ${dns} ist bereits vergeben.`, ephemeral: true });
            }

            mitarbeiter.push({ name, dns, iban });
            fs.writeFileSync(MITARBEITER_PATH, JSON.stringify(mitarbeiter, null, 2));

            return interaction.reply({ content: `✅ ${name} wurde mit der DNS ${dns} und IBAN ${iban} eingestellt.`, ephemeral: true });
        }

        if (interaction.commandName === 'nächstefreiedns') {
            let mitarbeiter = [];
            if (fs.existsSync(MITARBEITER_PATH)) {
                mitarbeiter = JSON.parse(fs.readFileSync(MITARBEITER_PATH));
            }

            const belegteDns = mitarbeiter.map(m => m.dns);
            let freieDns = 1;
            while (belegteDns.includes(freieDns)) {
                freieDns++;
            }

            return interaction.reply({ content: `🔍 Die nächste freie DNS ist: **${freieDns}**`, ephemeral: true });
        }

        if (interaction.commandName === 'kündigen') {
            const dns = interaction.options.getInteger('dns');
            let mitarbeiter = [];
            if (fs.existsSync(MITARBEITER_PATH)) {
                mitarbeiter = JSON.parse(fs.readFileSync(MITARBEITER_PATH, 'utf8'));
            }

            const index = mitarbeiter.findIndex(m => m.dns === dns);
            if (index === -1) {
                return interaction.reply({ content: `⚠️ Kein Mitarbeiter mit DNS ${dns} gefunden.`, ephemeral: true });
            }

            const entfernt = mitarbeiter.splice(index, 1)[0];
            fs.writeFileSync(MITARBEITER_PATH, JSON.stringify(mitarbeiter, null, 2), 'utf8');

            return interaction.reply({ content: `✅ Mitarbeiter **${entfernt.name}** mit DNS **${dns}** wurde gekündigt.`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);