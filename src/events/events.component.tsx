import '@fortawesome/fontawesome-free/css/all.css';
import * as FileSaver from 'file-saver';
import * as ics from 'ics-browser';
import * as React from 'react';
import { EventDocument } from 'src/common/models';
import './events.css';

export interface EventsComponentProperties {
    readonly currentUserId: string;
    readonly error?: string;
    readonly recentEvents?: EventDocument[];
    readonly upcomingEvents?: EventDocument[];
    readonly attendEvent: (event: EventDocument) => void;
    readonly unattendEvent: (event: EventDocument) => void;
    readonly addToCalendarEvent: (event: EventDocument) => void;
    readonly subscribeEvents: () => void;
    readonly unsubscribeEvents: () => void;
}

interface EventsComponentState {
    [eventId: string]: boolean;
}

export class EventsComponent extends React.Component<EventsComponentProperties, EventsComponentState> {

    public componentDidMount() {
        this.props.subscribeEvents();
    }

    public componentWillUnmount() {
        this.props.unsubscribeEvents();
    }

    public render() {
        return <>
            <h1>Upcoming Events</h1>
            <div className="row events-grid">
                {this.props.upcomingEvents && this.renderUpcomingEventsCards(this.props.upcomingEvents)}
            </div>
            <h1>Recent Events</h1>
            {this.renderEventsTable(this.props.recentEvents)}
            <span>{this.props.error}</span>
        </>;
    }

    private renderEventsTable(events?: EventDocument[]) {
        return <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Game</th>
                    <th>Attendees</th>
                    <th>Open Seats</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {events && this.renderEventsRows(events)}
            </tbody>
        </table>;
    }

    private renderUpcomingEventsCards(upcomingEvents: EventDocument[]) {
        return upcomingEvents.map((e, index) => {
            const keys = Object.keys(e.data.attendees);
            const openSeats = e.data.game.maxPlayers - keys.length;
            const timestamp = e.data.timestamp.toDate();
            const timestampMidnight = timestamp;
            timestampMidnight.setHours(0, 0, 0, 0);
            const now = new Date();
            const attending = e.data.attendees[this.props.currentUserId];
            const otherAttendees = keys.filter(k => k !== this.props.currentUserId).map(k => e.data.attendees[k]).sort((a1, a2) => {
                return a1.name.localeCompare(a2.name);
            });

            let openSeatsText = '';
            if (attending) {
                openSeatsText = 'You\'re Attending!';
            } else if (timestampMidnight <= now) {
                openSeatsText = 'Closed';
            } else if (openSeats > 0) {
                openSeatsText = openSeats + ' Seats Available';
            } else {
                openSeatsText = 'Full';
            }

            let actions = <></>;
            if (timestampMidnight > now) {
                if (!attending && openSeats > 0) {
                    actions = <button type="button" className="button-primary" onClick={this.attendEvent(e)}>Attend</button>;
                } else if (attending) {
                    actions = <div>
                        <button type="button" onClick={this.unattendEvent(e)}>Unattend</button>
                        &nbsp;
                        <button type="button" className="button-primary button-fa" onClick={this.addToCalendarEvent(e)}>
                            <i className="fas fa-calendar-plus fa-2x" />
                        </button>
                    </div>;
                }
            }

            return <div className="four columns card" key={index}>
                <h3><a href={e.data.game.bggLink} target="_blank">{e.data.game.name}</a></h3>
                <p>{timestamp.toDateString()}</p>
                <h5>
                    <em>{openSeatsText}</em>
                    {openSeats < e.data.game.maxPlayers && <>
                        &nbsp;
                        <a onClick={this.handleShowAttendees(e)}>
                            <i className="fas fa-question-circle" />
                        </a>
                    </>}
                </h5>
                {this.state && this.state[e.id] && <p>
                    <strong>Other Attendees:</strong>
                    <br />
                    {otherAttendees.map((a, i) => <span key={i}>{a.name}<br /></span>)}
                </p>}
                <div>{actions}</div>
            </div>;
        });
    }

    private handleShowAttendees(event: EventDocument) {
        const t = this;
        return (e: React.MouseEvent) => {
            t.setState((state, props) => {
                return {
                    ...state,
                    [event.id]: state ? !state[event.id] : true
                };
            });
        };
    }

    private renderEventsRows(events: EventDocument[]) {
        // events.sort((e1, e2) => e2.timestamp.toMillis() - e1.timestamp.toMillis());
        return events.map((e, index) => {
            const keys = Object.keys(e.data.attendees);
            const attendees = keys.map(k => e.data.attendees[k]).sort((a1, a2) => {
                if (a1.score !== undefined && a2.score !== undefined) {
                    return a2.score - a1.score;
                } else {
                    return a1.name.localeCompare(a2.name);
                }
            });
            const openSeats = e.data.game.maxPlayers - keys.length;
            const timestamp = e.data.timestamp.toDate();
            const timestampMidnight = timestamp;
            timestampMidnight.setHours(0, 0, 0, 0);
            const now = new Date();
            return <tr key={index}>
                <td>{timestamp.toDateString()}</td>
                <td><a href={e.data.game.bggLink} target="_blank">{e.data.game.name}</a></td>
                <td>{attendees.map((a, i) => (<span key={i}>{a.name}{a.score ? `: ${a.score}` : ''}<br /></span>))}</td>
                <td>{openSeats}</td>
                <td>{timestampMidnight > now && (!e.data.attendees[this.props.currentUserId] && openSeats > 0
                    ? <button type="button" onClick={this.attendEvent(e)}>Attend</button>
                    : <div><button type="button" onClick={this.unattendEvent(e)}>Unattend</button><button type="button" onClick={this.addToCalendarEvent(e)}>Add to Calendar</button></div>)}
                </td>
            </tr>;
        });
    }

    private attendEvent(event: EventDocument) {
        return () => this.props.attendEvent(event);
    }

    private unattendEvent(event: EventDocument) {
        return () => this.props.unattendEvent(event);
    }

    private addToCalendarEvent(event: EventDocument) {
        return () => {
            // create calendar event
            const eventDate = event.data.timestamp.toDate();
            const icsResult = ics.createEvent({
                description: `Jeff's Weekly Board Game Night!\nFeatured Game: ${event.data.game.name}\nBGG Link: ${event.data.game.bggLink}`,
                duration: { hours: 3 },
                location: '3464 Roxboro Rd NE\, Apt 409\, Atlanta\, GA 30326\, USA',
                start: [eventDate.getFullYear(), eventDate.getMonth() + 1, eventDate.getDate(), 19, 0],
                title: 'Board Game Night',
            });
            if (icsResult.value) {
                const blob = new Blob([icsResult.value], { type: 'text/calendar;charset=utf8' });
                FileSaver.saveAs(blob, `Board Game Night ${eventDate.toDateString()}.ics`);
            }
        };
    }
}