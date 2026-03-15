**Blogpost DemoWeek 2022**

<!--
 layout: project
 title: Chatmosphere 2.0 
 image: Link zum Bild / oder ihr schickt es uns so
 authors:
 \- author: David Grieshammer
 link: https://davidgrieshammer.com/
 \- author: Anke Riemer
 link: https://www.linkedin.com/in/anke-riemer-09371a76/
 \- author: Christian Ivanis
 link: http://christianivanis.com/
 brief: Wir erweitern Chatmosphere für große Gruppen und machen es stabiler.
 summary: Wir haben neue Features für die Kommunikation in großen Gruppen in Chatmosphere entwickelt, dazu eine session-übergreifende Architektur entworfen und eine Testumgebung bereit gestellt um die Serverlast zu evaluieren.

Huhu Marie, huhu Patricia: Die Bildunterschriften sind mit “Bildunterschrift” gekennzeichnet. _Bitte das Wort "Bildunterschrift" nicht mitkopieren 😅_

-->


# Chatmosphere ermöglicht dynamische Video-Gespräche im digitalen Raum #

Das Konzept entstand während des ersten coronabedingten Lockdowns 2020, als plötzlich ein Großteil unserer Kontakte digital stattgefunden hat. Auch die privaten Treffen waren digital, aber unsere Tools waren ausschließlich für den Arbeitskontext gestaltet. Durch die [Förderung in der Runde 8](https://archive.demoweek.prototypefund.de/runde8/projects/05-chatmosphere.html) des Prototype-Funds konnten wir eine Demo für ein fluides Interaktionskonzept erarbeiten und verproben.

![Proximity based interaction in Chatmosphere](https://github.com/Chatmosphere/chatmosphere-app/blob/27b902bb2b65296b70894c00cc80bf33070c87e8/docs/chatmosphere.gif)
Bildunterschrift: Chatmosphere in Aktion

Wir konnten ganz unterschiedliches Feedback sammeln und haben gelernt, dass die freie Bewegung im Raum und das selbstbestimmte Gruppieren und der Wechsel zwischen Gruppen viele Nutzer:innen gefehlt hat. Es konnte ein Gemeinschaftsgefühl wie an einem großen Tisch entstehen, und der Wunsch wurde laut, jetzt auch große Räume mit Platz für mehrere Gruppen (quasi für mehr Tische) zu ermöglichen.


# Chatmosphere 2.0: Skalierung #

Um Chatmosphere zu skalieren, wollten wir diese Untergruppen als fluide Breakout-Rooms möglich machen, sowie Interface-Paradigmen auf die Bedürfnisse größerer Gruppen ausrichten und die Performance bei mehreren Teilnehmer:innen verbessern. Zudem war unser Ziel ein einheitliches, erweiterbares Visual Design anzulegen und generell mehr aktive Teilhabe und Austauschmöglichkeiten rund um das Projekt zu ermöglichen.

Egal ob für einen gemeinsamen Kneipenabend, bei einem Universitäts-Seminar oder einen Workshop, zwei Wünsche waren ganz klar ersichtlich. Zum einen, dass bei Bedarf mehr Zuhörer:innen einer Person zuhören können. Zum anderen, dass eine Person sich Gehör verschaffen kann, auch wenn sich alle anderen gerade in kleinen Gruppen unterhalten.

Um möglichst schnell Feedback von echten Nutzer:innen zu bekommen, haben wir uns [auch dieses Mal dazu entschieden](https://chatmosphere.cc/user-test-1/), mit einem Design Sprint zu starten.


## _Welche Architektur braucht ein virtueller Raum für große Gruppen?_ ##

Wir sind mit der Annahme gestartet, größere Gruppen würden für eine gelingende Organisation extra Breakout-Rooms benötigen, also private Video-Chats für Subgruppen. Dies wurde durch unseren Designsprint und den Tests mit Nutzer:innen schnell widerlegt; das Kernelement der fluiden Gruppengespräche und der dynamischen Organisation in Chatmosphere funktioniert auch für größere Gruppen.

Parallele Kommunikation ist ja das Kernfeature von Chatmosphere. Breakout-Rooms im Sinne von separierten Sessions verhindern diesen fluiden Wechsel. Um in unserer Metapher zu bleiben, machen Breakout-Rooms aus dem gemeinsamen Raum, der gemeinsamen Bar oder dem Café mehrere kleine Wohnungen mit Tür. Zwar lässt sich mit Unter-Räumen die Serverlast recht einfach verteilen, aber Mauern zwischen die Gespräche zu ziehen ist für uns keine Option.

Um dennoch die Ressourcen der Client-Rechner und der Server zu senken, berechnen wir nun in Echtzeit, welche Videos auf welchen Geräten jeweils zu sehen sind und übertragen für jede:n Teilnehmer:in deren aktuell sichtbare Streams im Viewport. Zudem können wir dadurch auch über die Entfernung zueinander die jeweils sinnvolle Übertragungsqualität der Streams konfigurieren.


## _Learning: Die Testumgebung zu entwickeln, ist ein Prototyp für sich_ ##

Eine weitere Einsicht, welche wir bei der Erweiterung von Chatmosphere für große Gruppen gewinnen konnten, ist, dass eine nachvollziehbare und falsifizierbare Skalierung von Videochat-Applikationen zwingend eine Möglichkeit voraussetzt, reproduzierbare Lasttests zu fahren. Die einzig existierende frei zugängliche Lösung für solche Tests benötigt hohe Rechenleistung und ist aufgrund unterschiedlicher verwendeter Programmiersprachen komplex. Zudem sind Testkits speziell auf einzelne Anwendungen zugeschnitten und können nicht für generelle Lasttests verwendet werden.

Daher ist ein weiteres Ergebnis unserer Entwicklung ein Prototyp eines automatisierten Open-Source Testing-Werkzeugs ([Playwave](https://github.com/Chatmosphere/Playwave)), um nach Bedarf virtuelle Test-Teilnehmer:innen für generelle Videocalls (WebRTC Sessions) zu erzeugen.

![Spawned users in loadtest with playwave](https://github.com/Chatmosphere/chatmosphere-app/blob/27b902bb2b65296b70894c00cc80bf33070c87e8/docs/playwave_chatmosphere.png)

Bildunterschrift 1: Von [Playwave](https://github.com/Chatmosphere/Playwave) generierte Teilnehmer:innen, die mit bewegtem Bild und Ton Last erzeugen.  
  
Durch die Möglichkeit, automatisierte Testsessions zu erzeugen, konnten und können wir die Lastverteilung und Netzwerkbedarf auf den Servern analysieren und optimieren. Gleiches ist nun auch für Bildungseinrichtungen, Institutionen, Usergroups und interessierte Administrator:innen möglich, welche ihre Setups für hohe Auslastung optimieren möchten. Playwave kann zum Testen des Server-Setups für Chatmosphere, aber vor allem auch für Jitsi-Instanzen verwendet werden. Eventuell funktioniert die Anwendung auch für andere webbasierte Services, das wurde allerdings noch nicht getestet.


## _Interaktionsdesign für große Gruppen: Von fluiden Breakout-Rooms zur Vergemeinschaftung_ ##

Nach Designsprint und Exploration der technischen Limitierungen haben wir uns für ein Set an raumübergreifenden Kommunikations-Werkzeugen entschieden. Ziel ist hierbei die Kommunikation über mehrere gleichzeitige Gespräche hinweg.

- Speak-to-all
- Chat (to-all)
- Screenshare

Um den selbstorganisierenden und dezentralen Charakter von Chatmosphere zu erhalten, ist hierbei wichtig, dass diese Aktionen nicht nur von einer Person gesteuert werden. Beispielsweise können Teilnehmer:innen die Speak-to-all-Ansicht minimieren, wenn sie lieber im kleinen Gruppengespräch bleiben wollen.

Die Architektur der Features_Speak-to-all,_ als auch _Screenshare_ und _Chat_ ist so angelegt, dass zukünftig eine Übertragung auch auf mehrere parallel laufende Chatmosphere-Sessions möglich ist. Auch wenn wir uns in Anbetracht der Zeit dafür entschieden haben, zuerst die vergemeinschaftenden Kommunikationstools in einer Session zu entwickeln, ist diese Ausbaustufe schon angedacht.

Die Designkonzepte zeigen diese Überlegungen und Platzhalter für zusätzliche Funktionselemente wie Einstellungen, Teilnehmer:innenliste und vieles mehr.


## _Offenes Design_ ##

Diese vorbereitenden Entwürfe wurde mit der Überarbeitung des Visual Design verbunden, das nun gut dokumentiert und offen zugänglich hoffentlich auch Contributions durch die Community erleichtert.

Das neue Visual Design spiegelt den Charakter von Chatmosphere: anders, locker, kommunikativ und Open-Source. Alle für das Design genutzten Assets wie die neuen Schriften, Icons und die Emoji-Illustrationen sind Open-Source. Zudem haben wir in den letzten Monaten auch das Open-Source-Tool PenPot evaluiert und unsere Designfiles dorthin umgezogen.

In Penpot sind ein [Styleguide](https://design.penpot.app/#/view/1688b7e0-4248-11ec-a943-23056af0be2f?page-id=1688b7e1-4248-11ec-a943-23056af0be2f&section=interactions&index=0&share-id=a1d2f4f0-7f24-11ec-a93c-e5d362d27ee9), [Assets](https://design.penpot.app/#/view/1688b7e0-4248-11ec-a943-23056af0be2f?page-id=ab65d1b0-880a-11ec-a47a-a13271f6eb26&section=interactions&index=0&share-id=582ea260-8fd5-11ec-bd38-efdb6fa63305) für Kommunikationsmaterialien sowie Designspezifikationen für die App für alle zugänglich gemacht. Das [App-Design](https://design.penpot.app/#/view/1688b7e0-4248-11ec-a943-23056af0be2f?page-id=8d577360-4951-11ec-a7f9-67ad6282ae9e&section=interactions&index=0&share-id=889508f0-8fd4-11ec-bd38-efdb6fa63305) ist weiter ausgearbeitet und dokumentiert, um Contributions zu vereinfachen und die Anwendung konsistent weiterzuentwickeln. 

![CHatmosphere Open Design Styleguide in PenPot](https://github.com/Chatmosphere/chatmosphere-app/blob/eab9ddcc50f5c097de1562e7b4de5438d95604d4/docs/OpenDesignChatmosphere.png)  
Bildunterschrift:[Developer-Handoff über PenPot](https://design.penpot.app/#/view/1688b7e0-4248-11ec-a943-23056af0be2f?page-id=1688b7e1-4248-11ec-a943-23056af0be2f&section=interactions&index=0&share-id=a1d2f4f0-7f24-11ec-a93c-e5d362d27ee9)

Wireframes oder Clickdummies geben nun mehr Kontext für komplexere Issues in unserer Roadmap und sind in Github verlinkt. Alle neuen UI-Komponenten der App wie die erweiterte Menu-Bar, die neue Tab-Leiste oder die Settings sind so gestaltet, dass bereits geplante oder zukünftige Funktionen einfach hinzugefügt werden können.


## _Nachhaltige Weiterentwicklung_ ## 

Ab dem Launch im Februar 2021 gab es eigenständige Weiterentwicklungen durch unterschiedliche Einzelpersonen oder Communities. Für Pull-Requests und gemeinsame Weiterentwicklung gab es jedoch zu wenig Zeit und Raum. Auch unter den spannenden Projekten in der Community wie [einer Ausstellung basierend auf Chatmosphere](https://www.struggle.tv/session/fourthgarden), einem interaktiven Kindertheater oder eine digitale Kneipe gab es kaum Austausch.

Ein regelmäßiger [Community-Call](https://chatmosphere.cc/community-call/) soll über die Förderdauer hinaus den Austausch über Chatmosphere unterstützen. Ziel ist es, jeden ersten Dienstag des Monats Updates zu Releases und geplanten Features zu kommunizieren und Raum für Fragen und Neuigkeiten aus der Community zu geben. Während der Demo-Week, am Dienstag, dem 01.03. ist es übrigens wieder so weit.  
  
Um Chatmosphere nachhaltig weiterentwickeln zu können (oder zumindest zu maintainen) haben wir uns für die Organisationsform eines Open Collectives entschieden. Hier kann das [Projekt finanziell unterstützt](https://opencollective.com/chatmosphere) werden und wir können Infrastrukturkosten und Arbeitskosten transparent abrechnen. Danke an dieser Stelle an [Simon Höher](https://zero360.de/team/simon-hoeher/) und [Cade Diehm](https://simplysecure.org/who-we-are/cade/), die uns im Rahmen der Coachings sehr hilfreichen Input gegeben haben.  


# Vom Prototyp zur Infrastruktur #

Während wir in der ersten Runde der Förderung sehr frei explorieren konnten und selbst überrascht waren, wie viel wir in so kurzer Zeit schaffen konnten, war diese Runde ganz anders. Der Start mit einem Design Sprint ist immer noch empfehlenswert, um initiale Annahmen, wenn nötig, schnell zu revidieren. Da wir nun jedoch mit technischen Abhängigkeiten gestartet sind, ist eine andere Vorbereitung hilfreich um das nötige technische Hintergrundwissen sichtbar zu machen. Technical Debt, das Reagieren auf die Software-Updates von Chrome und Jitsi, aber auch unsere eigene Lernkurve haben für ein anderes Release-Tempo gesorgt.  
  
War Chatmopshere 1.0 ein Interaktionsprototyp, so ist Chatmosphere 2.0 ein Infrastruktur-Prototyp. Ungeplantes (wie beispielsweise das Testskript Playwave) konnte passieren, weil im Rahmen des Prototype-Funds der Freiraum zur Exploration und auch zum Verwerfen möglich ist.  
  
Vielen Dank an das Bundesministerium für Bildung und Forschung, dass dieses Format möglich gemacht hat und Danke an das Team des Prototype-Funds und des Deutschen Zentrums für Luft- und Raumfahrt für die emotionale, fachliche und administrative Unterstützung.


Bleibt gesund und trefft euch mit euren Freunden in Chatmosphere](https://app.chatmosphere.cc/) 

  
  
  
